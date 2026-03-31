// src/pages/institute/InstituteDashboard.tsx
// v2 — Redesigned to match TeacherDashboardPage glassmorphism design system

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

/* ------------------- STYLES (same as TeacherDashboard) ------------------- */
const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-entrance { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
  .animate-pop { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }

  .glass-panel {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 1);
    box-shadow: 0 10px 40px -10px rgba(99, 102, 241, 0.1), inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-panel {
    background: rgba(30, 41, 59, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }
  .glass-overlay {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(48px);
    border: 1px solid rgba(255, 255, 255, 1);
    box-shadow: 0 30px 60px -10px rgba(99, 102, 241, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-overlay {
    background: rgba(15, 23, 42, 0.90);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.7);
  }
  .inset-pill {
    background: rgba(255, 255, 255, 0.5);
    box-shadow: inset 4px 4px 10px rgba(99, 102, 241, 0.05), inset -4px -4px 10px rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.8);
  }
  .dark .inset-pill {
    background: rgba(15, 23, 42, 0.6);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.4), inset -4px -4px 10px rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .btn-glossy-indigo {
    background: linear-gradient(135deg, #818CF8 0%, #4F46E5 100%);
    box-shadow: inset 0px 2px 4px rgba(255,255,255,0.4), inset 0px -2px 4px rgba(0,0,0,0.15), 0px 8px 16px rgba(79, 70, 229, 0.3);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
  }
  .btn-glossy-indigo:hover { background: linear-gradient(135deg, #6366F1 0%, #4338CA 100%); }
  .btn-glossy-light {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    box-shadow: inset 0px 1px 2px rgba(255,255,255,1), 0px 4px 10px rgba(99, 102, 241, 0.05);
    border: 1px solid rgba(255, 255, 255, 1);
    color: #312E81;
  }
  .dark .btn-glossy-light {
    background: rgba(30, 41, 59, 0.6);
    box-shadow: inset 0px 1px 2px rgba(255,255,255,0.1), 0px 4px 10px rgba(0,0,0,0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #C7D2FE;
  }
  .btn-glossy-light:hover { background: rgba(255, 255, 255, 1); color: #4F46E5; }
  .dark .btn-glossy-light:hover { background: rgba(51, 65, 85, 0.8); }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Grid: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="2"/><rect width="7" height="7" x="14" y="3" rx="2"/><rect width="7" height="7" x="14" y="14" rx="2"/><rect width="7" height="7" x="3" y="14" rx="2"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Building: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  GradCap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  FileText: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  Upload: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>,
  UserPlus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>,
  Trophy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  TrendUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Eye: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Menu: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  Moon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  LogOut: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  AlertCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Clock: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
};

/* ------------------- REUSABLE COMPONENTS ------------------- */

const SidebarButton = ({ active, icon: Icon, label, onClick, badge }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 rounded-[32px] font-bold text-sm transition-all duration-300 active:scale-95 ${
      active
        ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-200/50 dark:border-slate-600/50"
        : "text-slate-500 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
    }`}
  >
    <div className={`${active ? "scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.3)]" : ""} transition-transform shrink-0`}><Icon /></div>
    <span className="truncate flex-1 text-left">{label}</span>
    {badge && (
      <span className="text-[10px] font-black bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-0.5 rounded-full">{badge}</span>
    )}
  </button>
);

const GlossyButton = ({ icon: Icon, label, subLabel, variant = "indigo", onClick, fullWidth = false, small = false }: any) => (
  <button
    onClick={onClick}
    className={`relative flex items-center justify-center gap-2 sm:gap-3 rounded-[32px] transform transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98] ${variant === "indigo" ? "btn-glossy-indigo" : "btn-glossy-light"} ${fullWidth ? "w-full" : "w-auto"} ${small ? "px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[48px]" : "px-5 sm:px-8 py-4 sm:py-5 min-h-[56px] sm:min-h-[64px] text-base sm:text-lg"} overflow-hidden group`}
  >
    {Icon && (
      <div className={`flex items-center justify-center rounded-full ${variant === "light" ? "bg-indigo-50 text-indigo-600 dark:bg-slate-800/80 dark:text-indigo-400" : "bg-white/20 text-white"} backdrop-blur-md ${small ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8 sm:h-10 sm:w-10"} border border-white/40 shadow-inner group-hover:scale-110 transition-transform shrink-0`}>
        <Icon />
      </div>
    )}
    <div className="flex flex-col text-left min-w-0">
      <span className="font-bold leading-none tracking-tight truncate">{label}</span>
      {subLabel && !small && <span className="mt-1 sm:mt-1.5 text-xs font-medium opacity-80 truncate">{subLabel}</span>}
    </div>
    {!small && <div className="ml-auto pl-2 sm:pl-4 opacity-50 group-hover:translate-x-1 transition-transform shrink-0"><Icons.ChevronRight /></div>}
  </button>
);

const StatCard = ({ icon: Icon, title, value, change, changeType = "up", delay = 0 }: any) => (
  <div className="glass-panel rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col items-center text-center hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300 animate-entrance" style={{ animationDelay: `${delay}ms` }}>
    <div className="text-indigo-500 mb-3 sm:mb-5 inset-pill p-2.5 sm:p-4 rounded-[16px] sm:rounded-[24px] border-none shrink-0"><Icon /></div>
    <h3 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-1 sm:mb-2">{value}</h3>
    <p className="text-[9px] sm:text-[11px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest mb-2 sm:mb-4">{title}</p>
    <span className={`text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-[16px] sm:rounded-[20px] border ${
      changeType === "up" 
        ? "text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700/50" 
        : "text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700/50"
    }`}>{change}</span>
  </div>
);

/* ------------------- MOCK DATA ------------------- */
const mockTeachers = [
  { id: "1", name: "Dr. Sarah Johnson", email: "sarah@institute.com", subjects: ["Physics", "Mathematics"], status: "active", tests: 24, avgScore: 78 },
  { id: "2", name: "Prof. Michael Chen", email: "michael@institute.com", subjects: ["Chemistry", "Biology"], status: "active", tests: 18, avgScore: 82 },
  { id: "3", name: "Ms. Emily Davis", email: "emily@institute.com", subjects: ["English", "History"], status: "pending", tests: 0, avgScore: 0 },
  { id: "4", name: "Mr. Raj Patel", email: "raj@institute.com", subjects: ["Mathematics"], status: "active", tests: 31, avgScore: 85 },
];

const mockBatches = [
  { id: "1", name: "Class 9A", class: "9", subjects: ["Mathematics", "Science", "English"], teacher: "Dr. Sarah Johnson", students: 35, status: "active" },
  { id: "2", name: "Class 10B", class: "10", subjects: ["Mathematics", "Science", "Social Studies"], teacher: "Prof. Michael Chen", students: 42, status: "active" },
  { id: "3", name: "JEE Advanced", class: "12", subjects: ["Physics", "Chemistry", "Mathematics"], teacher: "Dr. Sarah Johnson", students: 28, status: "active" },
  { id: "4", name: "NEET Prep", class: "12", subjects: ["Physics", "Chemistry", "Biology"], teacher: "Prof. Michael Chen", students: 31, status: "active" },
];

const mockTests = [
  { id: "1", title: "Physics Midterm", batch: "Class 9A", teacher: "Dr. Sarah Johnson", avgScore: 78, taken: 32, total: 35, status: "completed" },
  { id: "2", title: "Chemistry Weekly", batch: "Class 10B", teacher: "Prof. Michael Chen", avgScore: 82, taken: 40, total: 42, status: "completed" },
  { id: "3", title: "JEE Practice #5", batch: "JEE Advanced", teacher: "Dr. Sarah Johnson", avgScore: 71, taken: 26, total: 28, status: "published" },
];

/* ------------------- MAIN COMPONENT ------------------- */
const InstituteDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Admin";

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => ({
    totalTeachers: mockTeachers.filter(t => t.status === "active").length,
    pendingTeachers: mockTeachers.filter(t => t.status === "pending").length,
    totalStudents: mockBatches.reduce((s, b) => s + b.students, 0),
    totalBatches: mockBatches.length,
    avgScore: Math.round(mockTests.reduce((s, t) => s + t.avgScore, 0) / mockTests.length),
  }), []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add("dark"); else root.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getFirstName = () => displayName?.split(" ")[0] || "Admin";

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSent(true);
    setTimeout(() => { setInviteSent(false); setShowInviteModal(false); setInviteEmail(""); }, 2000);
  };

  const navItems = [
    { id: "dashboard", icon: Icons.Grid, label: "Dashboard" },
    { id: "teachers", icon: Icons.Users, label: "Teachers", badge: stats.pendingTeachers > 0 ? String(stats.pendingTeachers) : undefined },
    { id: "batches", icon: Icons.GradCap, label: "Batches" },
    { id: "tests", icon: Icons.FileText, label: "Tests" },
    { id: "attendance", icon: Icons.Calendar, label: "Attendance" },
    { id: "notes", icon: Icons.Upload, label: "Notes" },
  ];

  const statusBadge = (status: string) => {
    const map: any = {
      active: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
      pending: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
      completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
      published: "bg-indigo-100 text-indigo-700 border-indigo-200",
      inactive: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return map[status] || map.inactive;
  };

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="flex h-[100dvh] w-full font-sans text-slate-800 dark:text-slate-100 overflow-hidden relative bg-slate-100 dark:bg-slate-900 transition-colors duration-500">
        <style>{customStyles}</style>

        {/* Background gradients */}
        <div className="absolute top-0 left-0 w-full h-[70vh] bg-gradient-to-b from-indigo-200/90 via-violet-100/40 to-transparent dark:from-indigo-900/60 dark:via-indigo-900/20 pointer-events-none z-0" />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[40rem] sm:w-[60rem] h-[20rem] sm:h-[30rem] bg-indigo-300/40 dark:bg-indigo-800/40 rounded-full filter blur-[100px] pointer-events-none z-0" />

        {mobileMenuOpen && <div className="fixed inset-0 bg-white/20 dark:bg-black/60 backdrop-blur-md z-[190] lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

        {/* ===== SIDEBAR ===== */}
        <aside className={`fixed lg:relative top-0 left-0 w-[280px] sm:w-[300px] h-full flex flex-col bg-slate-50 dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800 z-[200] lg:z-50 shrink-0 transform transition-transform duration-300 overflow-y-auto ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="p-5 sm:p-8 pb-4">
            <div className="flex items-center justify-between mb-8 sm:mb-10 animate-entrance" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Icons.Building />
                </div>
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white">a4ai</span>
                <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full uppercase tracking-widest">Institute</span>
              </div>
              <button className="lg:hidden text-slate-500 bg-white/50 p-2 rounded-full" onClick={() => setMobileMenuOpen(false)}><Icons.X /></button>
            </div>

            <div className="bg-slate-100/80 dark:bg-slate-800/40 p-2.5 sm:p-3 rounded-[40px] shadow-inner border border-white/60 dark:border-white/5 animate-entrance" style={{ animationDelay: "200ms" }}>
              <nav className="space-y-1.5 sm:space-y-2">
                {navItems.map((item) => (
                  <SidebarButton key={item.id} active={activeTab === item.id} icon={item.icon} label={item.label} badge={item.badge} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} />
                ))}
              </nav>
            </div>
          </div>

          {/* Sidebar bottom - institute info */}
          <div className="mt-auto p-5 sm:p-8 pt-4 animate-entrance" style={{ animationDelay: "300ms" }}>
            <div className="bg-slate-100/80 dark:bg-slate-800/40 p-5 sm:p-6 text-center rounded-[40px] shadow-inner border border-white/60 dark:border-white/5">
              <div className="mb-3 sm:mb-4 flex justify-center">
                <div className="rounded-[24px] bg-white dark:bg-slate-700 shadow-sm p-3 sm:p-4 text-2xl drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]">🏫</div>
              </div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-1 text-sm sm:text-base">Institute Plan</h4>
              <p className="text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm mb-4 sm:mb-5 font-bold">Active ✨</p>
              <GlossyButton label="Manage Plan" variant="indigo" small fullWidth onClick={() => navigate("/pricing")} />
            </div>
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1 h-full overflow-y-auto relative z-10 scroll-smooth pb-24 sm:pb-32">
          <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto relative">

            {/* Header */}
            <header className="relative z-[100] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-8 sm:mb-12 animate-entrance" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
                <button className="lg:hidden p-2.5 sm:p-3 text-indigo-600 glass-panel rounded-[20px] sm:rounded-[24px] shrink-0" onClick={() => setMobileMenuOpen(true)}><Icons.Menu /></button>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight truncate">Welcome, {getFirstName()}</h1>
                  <p className="text-slate-600 dark:text-indigo-200/70 text-sm sm:text-base mt-1 sm:mt-2 font-medium truncate">Manage your institute, teachers & batches.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
                <div className="hidden md:flex items-center inset-pill rounded-full p-1.5 w-48 lg:w-60">
                  <div className="pl-3 text-indigo-500"><Icons.Search /></div>
                  <input type="text" placeholder="Search..." className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white px-2 placeholder-slate-400" />
                </div>

                {/* Notifications */}
                <div className="relative shrink-0" ref={notifRef}>
                  <button onClick={() => setIsNotifOpen(!isNotifOpen)} className={`p-2.5 sm:p-3 rounded-[20px] sm:rounded-[24px] inset-pill transition-all relative active:scale-95 ${isNotifOpen ? "text-indigo-600" : "text-slate-500 dark:text-slate-300"}`}>
                    <Icons.Bell />
                    {stats.pendingTeachers > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-tr from-indigo-400 to-purple-600 rounded-full border-2 border-white shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}
                  </button>
                  {isNotifOpen && (
                    <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 glass-overlay rounded-[32px] sm:rounded-[40px] p-4 sm:p-5 flex flex-col gap-2 animate-pop z-[150]">
                      <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Notifications</h3>
                        <span className="text-[10px] font-bold btn-glossy-indigo px-2.5 py-1 rounded-full">{stats.pendingTeachers} New</span>
                      </div>
                      <div className="flex gap-3 items-start p-3 sm:p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] transition-colors cursor-pointer inset-pill border-none">
                        <div className="text-amber-500 shrink-0 mt-0.5"><Icons.AlertCircle /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{stats.pendingTeachers} teacher(s) pending approval</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">Review and approve new teachers.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile */}
                <div className="relative shrink-0" ref={profileRef}>
                  <div onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-300/50 dark:border-slate-600/50 cursor-pointer group">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate max-w-[120px]">{displayName}</p>
                      <p className="text-xs text-slate-500 font-medium">Institute Admin</p>
                    </div>
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-[20px] sm:rounded-[24px] inset-pill flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold group-hover:scale-105 transition-all shrink-0">
                      <Icons.Building />
                    </div>
                  </div>
                  {isProfileOpen && (
                    <div className="absolute right-0 top-full mt-3 w-64 sm:w-72 glass-overlay rounded-[32px] sm:rounded-[40px] p-3 flex flex-col gap-1.5 sm:gap-2 animate-pop z-[150]">
                      <div className="px-4 sm:px-5 py-3 sm:py-4 mb-1 sm:mb-2 inset-pill rounded-[28px] sm:rounded-[32px] border-none">
                        <p className="font-extrabold text-slate-800 dark:text-white text-base sm:text-lg truncate">{displayName}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                      </div>
                      <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] transition-colors">
                        <div className="flex items-center gap-3"><Icons.Moon /> Dark Mode</div>
                        <div className={`w-11 h-6 rounded-full shadow-inner relative flex items-center px-1 transition-colors ${isDarkMode ? "bg-indigo-500" : "bg-slate-300"}`}>
                          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isDarkMode ? "translate-x-5" : "translate-x-0"}`} />
                        </div>
                      </button>
                      <button onClick={() => navigate("/settings")} className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] transition-colors"><Icons.Settings /> Settings</button>
                      <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 my-1 mx-4" />
                      <button onClick={() => navigate("/login")} className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-[24px] transition-colors"><Icons.LogOut /> Logout</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* ===== DASHBOARD TAB ===== */}
            {activeTab === "dashboard" && (
              <div className="space-y-6 sm:space-y-8 animate-entrance">
                {/* Hero Card */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-8">
                  <div className="xl:col-span-2 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 lg:p-14 relative overflow-hidden flex flex-col justify-center group">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/60 to-transparent pointer-events-none rounded-[48px]" />
                    <div className="relative z-10 max-w-xl">
                      <div className="flex items-center gap-2 mb-4 sm:mb-6 bg-white/50 dark:bg-slate-800/50 border border-white/80 w-fit px-3 sm:px-5 py-1.5 sm:py-2 rounded-[20px] sm:rounded-[24px] shadow-sm">
                        <div className="text-indigo-500"><Icons.Building /></div>
                        <span className="text-[10px] sm:text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">Institute Management</span>
                      </div>
                      <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight leading-[1.1]">
                        Run your institute smarter.
                      </h2>
                      <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg mb-6 sm:mb-10 font-medium">
                        Manage teachers, track batches, monitor performance — all in one place.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <GlossyButton label="Invite Teacher" variant="indigo" icon={Icons.UserPlus} small onClick={() => setShowInviteModal(true)} />
                        <GlossyButton label="Create Batch" variant="light" icon={Icons.Plus} small onClick={() => setActiveTab("batches")} />
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-1 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 flex flex-col">
                    <div className="flex items-center gap-3 sm:gap-5 mb-6 sm:mb-8">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 inset-pill border-none flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner rounded-[24px] sm:rounded-[32px] shrink-0"><Icons.Trophy /></div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Quick Actions</h3>
                    </div>
                    <div className="space-y-3 sm:space-y-5">
                      <GlossyButton label="Invite Teacher" subLabel="Add to your team" variant="light" icon={Icons.UserPlus} fullWidth onClick={() => setShowInviteModal(true)} />
                      <GlossyButton label="New Batch" subLabel="Create class/section" variant="light" icon={Icons.Plus} fullWidth onClick={() => setActiveTab("batches")} />
                      <GlossyButton label="View Tests" subLabel="Monitor performance" variant="light" icon={Icons.FileText} fullWidth onClick={() => setActiveTab("tests")} />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-8">
                  <StatCard icon={Icons.Users} title="Active Teachers" value={stats.totalTeachers} change={`+${stats.pendingTeachers} pending`} changeType="up" delay={100} />
                  <StatCard icon={Icons.GradCap} title="Total Students" value={stats.totalStudents} change={`${stats.totalBatches} batches`} changeType="up" delay={200} />
                  <StatCard icon={Icons.Chart} title="Avg Test Score" value={`${stats.avgScore}%`} change="+5% this month" changeType="up" delay={300} />
                  <StatCard icon={Icons.FileText} title="Tests Created" value={mockTests.length} change="All time" changeType="up" delay={400} />
                </div>

                {/* Recent Tests + Teacher Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">
                  {/* Recent Tests */}
                  <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-10">
                    <div className="flex justify-between items-center mb-5 sm:mb-8">
                      <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-2xl">Recent Tests</h3>
                      <button onClick={() => setActiveTab("tests")} className="inset-pill text-indigo-600 dark:text-indigo-300 px-4 py-2 rounded-[20px] font-bold text-xs hover:bg-white/80 transition-colors border-none">View All</button>
                    </div>
                    <div className="space-y-3">
                      {mockTests.map((test) => (
                        <div key={test.id} className="flex items-center justify-between p-4 sm:p-5 rounded-[20px] sm:rounded-[28px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 hover:bg-white/80 transition-all group">
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="p-3 rounded-[16px] sm:rounded-[20px] inset-pill border-none text-indigo-500 shrink-0"><Icons.FileText /></div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base group-hover:text-indigo-600 transition-colors truncate">{test.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5 font-medium">{test.batch} · {test.teacher}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-black text-lg sm:text-xl text-slate-900 dark:text-white">{test.avgScore}%</p>
                            <p className="text-[10px] text-slate-500 font-medium">{test.taken}/{test.total} taken</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Teacher Performance */}
                  <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-10">
                    <div className="flex justify-between items-center mb-5 sm:mb-8">
                      <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-2xl">Teacher Performance</h3>
                      <button onClick={() => setActiveTab("teachers")} className="inset-pill text-indigo-600 dark:text-indigo-300 px-4 py-2 rounded-[20px] font-bold text-xs hover:bg-white/80 transition-colors border-none">View All</button>
                    </div>
                    <div className="space-y-3">
                      {mockTeachers.filter(t => t.status === "active").map((teacher) => (
                        <div key={teacher.id} className="flex items-center justify-between p-4 sm:p-5 rounded-[20px] sm:rounded-[28px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 hover:bg-white/80 transition-all">
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[16px] sm:rounded-[20px] inset-pill border-none flex items-center justify-center font-black text-indigo-600 text-lg shrink-0">{teacher.name.charAt(0)}</div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">{teacher.name}</h4>
                              <p className="text-xs text-slate-500 font-medium">{teacher.subjects.join(", ")}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-black text-emerald-600 dark:text-emerald-400 text-lg">{teacher.avgScore}%</p>
                            <p className="text-[10px] text-slate-500 font-medium">{teacher.tests} tests</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== TEACHERS TAB ===== */}
            {activeTab === "teachers" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
                    <div>
                      <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">Teachers</h2>
                      <p className="text-sm text-slate-500 mt-1 font-medium">{mockTeachers.length} teachers · {stats.pendingTeachers} pending</p>
                    </div>
                    <GlossyButton label="Invite Teacher" variant="indigo" icon={Icons.UserPlus} small onClick={() => setShowInviteModal(true)} />
                  </div>

                  <div className="relative mb-5 sm:mb-8">
                    <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-indigo-500"><Icons.Search /></div>
                    <input type="text" placeholder="Search teachers..." className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-3.5 sm:py-5 text-sm inset-pill rounded-[24px] sm:rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-400/50 text-slate-800 dark:text-white placeholder-slate-400 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>

                  <div className="space-y-3">
                    {mockTeachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map((teacher) => (
                      <div key={teacher.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 hover:bg-white/80 transition-all gap-3">
                        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] sm:rounded-[24px] inset-pill border-none flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-xl shrink-0">{teacher.name.charAt(0)}</div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg truncate">{teacher.name}</h4>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">{teacher.email}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {teacher.subjects.map(s => (
                                <span key={s} className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-200/50 dark:border-indigo-700/30">{s}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 ml-auto sm:ml-0">
                          {teacher.status === "active" && (
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 inset-pill border-none px-3 py-1.5 rounded-[16px]">{teacher.tests} tests · {teacher.avgScore}%</span>
                          )}
                          <span className={`text-[10px] px-3 py-1.5 rounded-[16px] font-bold uppercase tracking-wider border ${statusBadge(teacher.status)}`}>{teacher.status}</span>
                          {teacher.status === "pending" && (
                            <button className="p-2 rounded-[16px] inset-pill border-none text-emerald-600 hover:bg-emerald-50 transition-colors"><Icons.Check /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== BATCHES TAB ===== */}
            {activeTab === "batches" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                  <div>
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">Batches</h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{mockBatches.length} batches · {stats.totalStudents} students</p>
                  </div>
                  <GlossyButton label="New Batch" variant="indigo" icon={Icons.Plus} small />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {mockBatches.map((batch) => (
                    <div key={batch.id} className="glass-panel rounded-[28px] sm:rounded-[40px] p-5 sm:p-8 hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                      <div className="flex items-start justify-between mb-4 sm:mb-6">
                        <div className="min-w-0">
                          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{batch.name}</h3>
                          <p className="text-sm text-slate-500 font-medium mt-1">Teacher: {batch.teacher}</p>
                        </div>
                        <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 rounded-full uppercase tracking-wider shrink-0">Class {batch.class}</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {batch.subjects.map(s => (
                          <span key={s} className="text-[10px] font-bold bg-white/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-white/80 dark:border-white/10">{s}</span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                        <div>
                          <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">{batch.students}</p>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Students</p>
                        </div>
                        <GlossyButton label="Manage" variant="light" small />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== TESTS TAB ===== */}
            {activeTab === "tests" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
                    <div>
                      <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">All Tests</h2>
                      <p className="text-sm text-slate-500 mt-1 font-medium">{mockTests.length} tests across all batches</p>
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {mockTests.map((test) => (
                      <div key={test.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 hover:bg-white/80 transition-all group gap-3">
                        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                          <div className="p-3 sm:p-4 rounded-[16px] sm:rounded-[24px] inset-pill border-none text-indigo-500 shadow-inner shrink-0"><Icons.FileText /></div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg group-hover:text-indigo-600 transition-colors truncate">{test.title}</h4>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">{test.batch} · {test.teacher}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 ml-auto sm:ml-0 flex-shrink-0">
                          <span className="text-sm font-black text-slate-900 dark:text-white inset-pill border-none px-3 py-1.5 rounded-[16px]">{test.avgScore}%</span>
                          <span className="text-xs font-bold text-slate-500 inset-pill border-none px-3 py-1.5 rounded-[16px]">{test.taken}/{test.total}</span>
                          <span className={`text-[10px] px-3 py-1.5 rounded-[16px] font-bold uppercase tracking-wider border ${statusBadge(test.status)}`}>{test.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== ATTENDANCE TAB ===== */}
            {activeTab === "attendance" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-8 sm:p-10 min-h-[300px] sm:min-h-[500px] flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none text-indigo-500 rounded-full flex items-center justify-center mb-6 sm:mb-8"><Icons.Calendar /></div>
                  <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3 sm:mb-4">Attendance Tracking</h3>
                  <p className="text-slate-500 font-medium max-w-sm text-sm sm:text-lg mb-6">Track student attendance batch-wise with daily reports.</p>
                  <GlossyButton label="Coming Soon" variant="light" small />
                </div>
              </div>
            )}

            {/* ===== NOTES TAB ===== */}
            {activeTab === "notes" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-8 sm:p-10 min-h-[300px] sm:min-h-[500px] flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none text-indigo-500 rounded-full flex items-center justify-center mb-6 sm:mb-8"><Icons.Upload /></div>
                  <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3 sm:mb-4">Study Materials</h3>
                  <p className="text-slate-500 font-medium max-w-sm text-sm sm:text-lg mb-6">Upload & share notes, PDFs, and resources with batches.</p>
                  <GlossyButton label="Coming Soon" variant="light" small />
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ===== INVITE MODAL ===== */}
        {showInviteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-pop">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={() => setShowInviteModal(false)} />
            <div className="glass-overlay p-6 sm:p-10 lg:p-12 rounded-[32px] sm:rounded-[56px] w-full max-w-md relative z-10 text-center">
              <button onClick={() => setShowInviteModal(false)} className="absolute top-4 sm:top-8 right-4 sm:right-8 p-2 sm:p-3 text-slate-400 inset-pill border-none rounded-full hover:text-indigo-600"><Icons.X /></button>
              {!inviteSent ? (
                <>
                  <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none text-indigo-600 rounded-[24px] sm:rounded-[36px] flex items-center justify-center mx-auto mb-5 sm:mb-8"><div className="scale-110 sm:scale-125"><Icons.UserPlus /></div></div>
                  <h3 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-4 text-slate-900 dark:text-white">Invite Teacher</h3>
                  <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-10 font-medium">Send an email invitation to join your institute.</p>
                  <form onSubmit={handleInvite} className="space-y-5 sm:space-y-8 text-left">
                    <div className="relative">
                      <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-indigo-400"><Icons.UserPlus /></div>
                      <input required type="email" placeholder="Teacher's Email" className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-4 sm:py-5 rounded-[24px] sm:rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-indigo-400/50 font-bold text-slate-800 dark:text-white placeholder-slate-400" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                    </div>
                    <GlossyButton label="Send Invitation" variant="indigo" fullWidth />
                  </form>
                </>
              ) : (
                <div className="py-8 sm:py-10">
                  <div className="w-20 h-20 sm:w-28 sm:h-28 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-indigo-200/50"><div className="scale-125 sm:scale-150"><Icons.Check /></div></div>
                  <h4 className="font-black text-2xl sm:text-3xl text-slate-900 dark:text-white mb-3 sm:mb-4">Invitation Sent!</h4>
                  <p className="text-slate-500 font-medium text-sm sm:text-lg">They'll appear once they accept.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstituteDashboard;