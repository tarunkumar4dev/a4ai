// src/pages/institute/InstituteDashboardPage.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — Institute admin dashboard
//
// For the institute owner/admin. Students & teachers join from JoinInstitutePage
// using a code → they land in a Pending queue → admin approves → they appear in
// the correct roster (Students / Teachers), assignable to a batch/subject.
//
// Backed by Supabase (tables `institutes` + `institute_members`, RLS, and the
// `join_institute` RPC). Realtime keeps the roster live. If the tables aren't
// reachable, the page falls back to demo data.
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

/* ------------------- STYLES (shared shell tokens) ------------------- */
const customStyles = `
  @keyframes fadeInUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
  @keyframes scaleIn  { from { opacity:0; transform:scale(0.96);}      to { opacity:1; transform:scale(1);} }
  @keyframes dropIn   { from { opacity:0; transform:translateY(-10px) scale(0.97);} to { opacity:1; transform:translateY(0) scale(1);} }
  @keyframes blobBounce {
    0%{transform:translate(0,0) scale(1);} 33%{transform:translate(30px,-50px) scale(1.1);}
    66%{transform:translate(-20px,20px) scale(0.9);} 100%{transform:translate(0,0) scale(1);}
  }
  .animate-blob { animation: blobBounce 15s infinite ease-in-out alternate; }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
  .animate-entrance { animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) forwards; opacity:0; }
  .animate-pop      { animation: scaleIn  0.28s cubic-bezier(0.16,1,0.3,1) forwards; }
  .animate-row      { animation: dropIn   0.22s cubic-bezier(0.16,1,0.3,1) forwards; }

  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius:10px; }
  .dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }

  .glass-panel {
    background: rgba(255,255,255,0.85); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255,255,255,0.6);
    box-shadow: 0 20px 40px -15px rgba(0,0,0,0.05), inset 0 1px 0 0 rgba(255,255,255,1);
  }
  .dark .glass-panel {
    background: rgba(18,18,22,0.75); border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 20px 40px -15px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.05);
  }
  .glass-overlay {
    background: rgba(255,255,255,0.95); backdrop-filter: blur(48px); border: 1px solid rgba(255,255,255,0.8);
    box-shadow: 0 30px 60px -10px rgba(0,0,0,0.1), inset 0 1px 0 0 rgba(255,255,255,1);
  }
  .dark .glass-overlay {
    background: rgba(15,15,18,0.95); border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 30px 60px -10px rgba(0,0,0,0.9);
  }
  .inset-pill {
    background: rgba(0,0,0,0.03);
    box-shadow: inset 2px 2px 5px rgba(0,0,0,0.03), inset -2px -2px 5px rgba(255,255,255,0.8);
    border: 1px solid rgba(0,0,0,0.04);
  }
  .dark .inset-pill {
    background: rgba(255,255,255,0.04);
    box-shadow: inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
  }
  .btn-glossy-theme {
    background: linear-gradient(135deg, var(--theme-start) 0%, var(--theme-end) 100%);
    box-shadow: inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3), 0 8px 20px var(--theme-shadow);
    border: 1px solid rgba(255,255,255,0.25); color:#fff; position:relative; overflow:hidden;
  }
  .btn-glossy-theme::before {
    content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent); transition:left .5s ease;
  }
  .btn-glossy-theme:hover::before { left:100%; }
  .btn-glossy-theme:hover  { filter:brightness(1.1); transform:translateY(-1px); }
  .btn-glossy-theme:active { transform:translateY(0); filter:brightness(0.95); }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  Search:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Bell:         () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Grid:         () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="2"/><rect width="7" height="7" x="14" y="3" rx="2"/><rect width="7" height="7" x="14" y="14" rx="2"/><rect width="7" height="7" x="3" y="14" rx="2"/></svg>,
  Users:        () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  GradCap:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  FileText:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Clock:        () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  ChevronDown:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  Check:        () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:            () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Menu:         () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  Sun:          () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  User:         () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  LogOut:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  Copy:         () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Refresh:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>,
  Share:        () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>,
  Trash:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  UserPlus:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>,
  Shield:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  Sparkles:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/></svg>,
  Loader:       () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
};

/* ------------------- THEME COLORS ------------------- */
const COLOR_SCHEMES = {
  indigo:  { start: '#6366f1', end: '#4f46e5', shadow: 'rgba(99,102,241,0.35)' },
  teal:    { start: '#0ea5e9', end: '#0d9488', shadow: 'rgba(14,165,233,0.35)' },
  violet:  { start: '#8b5cf6', end: '#6d28d9', shadow: 'rgba(139,92,246,0.35)' },
  rose:    { start: '#f43f5e', end: '#be123c', shadow: 'rgba(244,63,94,0.35)' },
  amber:   { start: '#f59e0b', end: '#d97706', shadow: 'rgba(245,158,11,0.35)' },
  emerald: { start: '#10b981', end: '#047857', shadow: 'rgba(16,185,129,0.35)' },
};

/* ------------------- TYPES ------------------- */
type Role = "student" | "teacher";
type MemberStatus = "active" | "pending";
type Tab = "overview" | "students" | "teachers" | "pending";

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  group_name: string;
  created_at: string;
}

interface Institute {
  id: string;
  name: string;
  student_code: string;
  teacher_code: string;
}

/* ------------------- CONSTANTS & HELPERS ------------------- */
const BATCHES = ["JEE 2026", "NEET 2026", "Foundation IX–X", "CUET 2026"];
const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "English"];
const ROLE_ACCENT: Record<Role, string> = { student: "#0ea5e9", teacher: "#8b5cf6" };

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randCode = (n = 4) => Array.from({ length: n }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join("");
const makeCode = (role: Role) => `A4I-${role === "student" ? "STU" : "TCH"}-${randCode(4)}`;

const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function copyText(text: string): Promise<void> {
  try { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text); } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch { /* noop */ }
  document.body.removeChild(ta);
  return Promise.resolve();
}

/* ------------------- DEMO FALLBACK ------------------- */
const demoInstitute = (name: string): Institute => ({
  id: "demo", name, student_code: makeCode("student"), teacher_code: makeCode("teacher"),
});
const demoMembers = (): Member[] => ([
  { id: "d1", full_name: "Aarav Sharma", email: "aarav@student.in", role: "student", status: "active", group_name: "JEE 2026", created_at: new Date().toISOString() },
  { id: "d2", full_name: "Diya Patel", email: "diya.p@student.in", role: "student", status: "active", group_name: "NEET 2026", created_at: new Date().toISOString() },
  { id: "d3", full_name: "Kabir Nair", email: "kabir@student.in", role: "student", status: "active", group_name: "", created_at: new Date().toISOString() },
  { id: "d4", full_name: "Meera Iyer", email: "meera.i@a4ai.in", role: "teacher", status: "active", group_name: "Physics", created_at: new Date().toISOString() },
  { id: "d5", full_name: "Rohan Gupta", email: "rohan.g@a4ai.in", role: "teacher", status: "active", group_name: "Mathematics", created_at: new Date().toISOString() },
  { id: "d6", full_name: "Sana Khan", email: "sana@student.in", role: "student", status: "pending", group_name: "", created_at: new Date().toISOString() },
  { id: "d7", full_name: "Vikram Rao", email: "vikram.r@a4ai.in", role: "teacher", status: "pending", group_name: "", created_at: new Date().toISOString() },
]);

/* ------------------- COMPONENTS ------------------- */
const SidebarButton = ({ active, Icon, label, colorClass, badge, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 rounded-[16px] font-bold text-sm transition-all duration-300 active:scale-95 ${
      active 
        ? "bg-white/80 dark:bg-white/10 shadow-lg text-slate-900 dark:text-white backdrop-blur-md" 
        : "text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
    }`}
  >
    <div className="flex items-center gap-3.5">
      <div className={`${active ? "scale-110" : ""} transition-transform shrink-0 ${colorClass}`}><Icon /></div>
      <span className="truncate tracking-wide">{label}</span>
    </div>
    {badge > 0 ? (
      <span className="text-[11px] font-black text-white rounded-full px-2 py-0.5 min-w-[22px] text-center shadow-sm" style={{ background: "var(--theme-start)" }}>{badge}</span>
    ) : null}
  </button>
);

const Avatar = ({ name, color }: { name: string; color: string }) => (
  <div className="flex items-center justify-center rounded-[14px] shrink-0 font-black text-sm text-white shadow-sm"
    style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
    {initials(name)}
  </div>
);

function CodeCard({ role, code, count, copied, onCopy, onRegen }: {
  role: Role; code: string; count: number; copied: boolean; onCopy: () => void; onRegen: () => void;
}) {
  const accent = ROLE_ACCENT[role];
  const Icon = role === "student" ? Icons.GradCap : Icons.Users;
  const link = `app.a4ai.in/join?code=${code}`;
  return (
    <div className="glass-panel rounded-[28px] sm:rounded-[32px] p-6 relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: accent }} />
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[16px] inset-pill flex items-center justify-center shadow-sm" style={{ color: accent }}><Icon /></div>
            <div>
              <div className="font-black text-slate-900 dark:text-white text-[15px]">{role === "student" ? "Student Join Code" : "Teacher Join Code"}</div>
              <div className="text-xs text-slate-500 font-medium">{count} members onboarded</div>
            </div>
          </div>
        </div>

        <div className="inset-pill rounded-[20px] flex items-center justify-between px-4 py-3 mb-3">
          <span className="font-mono tracking-[2px] text-lg font-black text-slate-900 dark:text-white">{code}</span>
          <button onClick={onCopy}
            className="flex items-center gap-1.5 rounded-[14px] px-3.5 py-2 text-[13px] font-bold text-white transition-all shadow-md active:scale-95"
            style={{ background: copied ? "#10b981" : accent }}>
            {copied ? <Icons.Check /> : <Icons.Copy />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
        <div className="flex-1 flex items-center gap-2 rounded-[14px] px-3 py-2 inset-pill truncate text-slate-500">
          <Icons.Share />
          <span className="truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">{link}</span>
        </div>
        <button onClick={onRegen} title="Generate new code"
          className="flex items-center gap-1.5 rounded-[14px] px-3.5 py-2 text-[12.5px] font-bold text-slate-600 dark:text-slate-300 inset-pill active:scale-95 transition-all">
          <Icons.Refresh /> Reset
        </button>
      </div>
    </div>
  );
}

function MemberRow({ member, onApprove, onReject, onRemove, onGroup }: {
  member: Member;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemove: (id: string) => void;
  onGroup: (id: string, group: string) => void;
}) {
  const accent = ROLE_ACCENT[member.role];
  const groupList = member.role === "student" ? BATCHES : SUBJECTS;
  return (
    <div className="flex items-center gap-4 p-4 rounded-[22px] glass-panel hover:shadow-md transition-all animate-row">
      <Avatar name={member.full_name} color={accent} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{member.full_name}</span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: `${accent}15`, color: accent }}>
            {member.role === "student" ? "Student" : "Teacher"}
          </span>
          {member.status === "active" && member.group_name && (
            <span className="text-[11px] text-slate-500 font-medium">· {member.group_name}</span>
          )}
        </div>
        <div className="truncate text-[12.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          {member.email} · Joined {fmtDate(member.created_at)}
        </div>
      </div>

      {member.status === "pending" ? (
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onApprove(member.id)}
            className="rounded-[14px] px-4 py-2 text-[12.5px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm active:scale-95 transition-all">Approve</button>
          <button onClick={() => onReject(member.id)}
            className="rounded-[14px] px-4 py-2 text-[12.5px] font-bold text-slate-600 dark:text-slate-300 inset-pill active:scale-95 transition-all">Reject</button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative hidden sm:block">
            <select value={member.group_name} onChange={(e) => onGroup(member.id, e.target.value)}
              className="appearance-none rounded-[14px] pr-8 pl-3.5 py-2 inset-pill text-[12.5px] font-bold text-slate-700 dark:text-slate-200 bg-transparent outline-none cursor-pointer">
              <option value="">{member.role === "student" ? "Assign Batch" : "Assign Subject"}</option>
              {groupList.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Icons.ChevronDown /></div>
          </div>
          <button onClick={() => onRemove(member.id)} title="Remove member"
            className="w-9 h-9 rounded-[14px] inset-pill flex items-center justify-center text-slate-400 hover:text-rose-500 active:scale-95 transition-all"><Icons.Trash /></button>
        </div>
      )}
    </div>
  );
}

function JoinModal({ onClose, onJoin }: { onClose: () => void; onJoin: (name: string, email: string, code: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const field = "w-full py-3.5 px-4 rounded-[18px] inset-pill focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-bold text-slate-800 dark:text-white placeholder-slate-400 text-sm";
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-pop">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-overlay p-6 sm:p-8 rounded-[32px] w-full max-w-md relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Add Member Manually</h3>
          <button onClick={onClose} className="p-2 text-slate-500 inset-pill rounded-full hover:scale-105"><Icons.X /></button>
        </div>
        <p className="text-sm text-slate-500 font-medium mb-6">Enter member details and join code to place them securely into the pending queue.</p>
        <div className="space-y-3.5 mb-6">
          <input className={field} placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={field} placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={`${field} font-mono tracking-[1px] uppercase`} placeholder="Join Code (A4I-…)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </div>
        <button onClick={() => onJoin(name, email, code)}
          className="w-full py-4 rounded-[20px] font-bold text-white btn-glossy-theme shadow-lg">Submit Request</button>
      </div>
    </div>
  );
}

/* ------------------- MAIN COMPONENT ------------------- */
export default function InstituteDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Admin";

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [activeTheme, setActiveTheme] = useState<keyof typeof COLOR_SCHEMES>("violet");
  const currentThemeConfig = COLOR_SCHEMES[activeTheme];

  const [institute, setInstitute] = useState<Institute | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<Role | "">("");
  const [toast, setToast] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add("dark"); else root.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false); setShowAppearance(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: inst, error: instErr } = await supabase
          .from("institutes").select("id, name, student_code, teacher_code").eq("owner_id", user.id).single();
        if (instErr || !inst) throw instErr || new Error("no-institute");

        const { data: mem } = await supabase
          .from("institute_members")
          .select("id, full_name, email, role, status, group_name, created_at")
          .eq("institute_id", inst.id)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        setInstitute(inst as Institute);
        setMembers((mem as Member[]) || []);
        setIsDemo(false);
      } catch {
        if (cancelled) return;
        setInstitute(demoInstitute(`${displayName}'s Institute`));
        setMembers(demoMembers());
        setIsDemo(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, displayName]);

  useEffect(() => {
    if (!institute || isDemo) return;
    const channel = supabase
      .channel(`institute-members-${institute.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "institute_members", filter: `institute_id=eq.${institute.id}` },
        (payload) => {
          setMembers((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Member;
              return [row, ...prev.filter((m) => m.id !== row.id)];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Member;
              return prev.map((m) => (m.id === row.id ? row : m));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== (payload.old as Member).id);
            }
            return prev;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [institute, isDemo]);

  const ping = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  const copy = (role: Role) => {
    if (!institute) return;
    copyText(role === "student" ? institute.student_code : institute.teacher_code);
    setCopied(role);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const regen = async (role: Role) => {
    if (!institute) return;
    const code = makeCode(role);
    const col = role === "student" ? "student_code" : "teacher_code";
    setInstitute({ ...institute, [col]: code });
    if (!isDemo) {
      const { error } = await supabase.from("institutes").update({ [col]: code }).eq("id", institute.id);
      if (error) { ping("Couldn't update code — try again."); return; }
    }
    ping(`New ${role} code generated successfully.`);
  };

  const approve = async (id: string) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, status: "active" } : m)));
    if (!isDemo) await supabase.from("institute_members").update({ status: "active" }).eq("id", id);
    ping("Member approved and added to roster.");
  };

  const reject = async (id: string) => {
    setMembers((ms) => ms.filter((m) => m.id !== id));
    if (!isDemo) await supabase.from("institute_members").delete().eq("id", id);
    ping("Member request rejected.");
  };

  const removeMember = async (id: string) => {
    setMembers((ms) => ms.filter((m) => m.id !== id));
    if (!isDemo) await supabase.from("institute_members").delete().eq("id", id);
    ping("Member removed from institute.");
  };

  const setGroup = async (id: string, group_name: string) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, group_name } : m)));
    if (!isDemo) await supabase.from("institute_members").update({ group_name }).eq("id", id);
  };

  const join = async (name: string, email: string, code: string) => {
    if (!institute) return;
    if (!name.trim() || !email.trim()) return ping("Enter a name and email first.");
    const role: Role | null =
      code.trim() === institute.student_code ? "student" :
      code.trim() === institute.teacher_code ? "teacher" : null;
    if (!role) return ping("Invalid join code provided.");

    if (isDemo) {
      const member: Member = {
        id: generateUUID(), full_name: name.trim(), email: email.trim(),
        role, status: "pending", group_name: "", created_at: new Date().toISOString(),
      };
      setMembers((ms) => [member, ...ms]);
    } else {
      const { error } = await supabase.from("institute_members").insert({
        institute_id: institute.id, full_name: name.trim(), email: email.trim(), role, status: "pending",
      });
      if (error) { ping("Couldn't add member — check RLS policies."); return; }
    }

    setShowJoin(false);
    setActiveTab("pending");
    ping(`${name.trim()} added to pending requests.`);
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); navigate("/login"); } catch (e) { console.error(e); }
  };

  const studentCount = members.filter((m) => m.role === "student" && m.status === "active").length;
  const teacherCount = members.filter((m) => m.role === "teacher" && m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  const rosterTab: Role | "pending" = activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "pending";
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => (rosterTab === "pending" ? m.status === "pending" : m.role === rosterTab && m.status === "active"))
      .filter((m) => !q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, rosterTab, query]);

  const navItems = [
    { id: "overview" as Tab, Icon: Icons.Grid,    label: "Overview",  color: "text-sky-500",    badge: 0 },
    { id: "students" as Tab, Icon: Icons.GradCap, label: "Students",  color: "text-emerald-500",badge: 0 },
    { id: "teachers" as Tab, Icon: Icons.Users,   label: "Teachers",  color: "text-purple-500", badge: 0 },
    { id: "pending"  as Tab, Icon: Icons.Bell,    label: "Requests",  color: "text-amber-500",  badge: pendingCount },
  ];

  return (
    <div
      className={isDarkMode ? "dark" : ""}
      style={{ '--theme-start': currentThemeConfig.start, '--theme-end': currentThemeConfig.end, '--theme-shadow': currentThemeConfig.shadow } as React.CSSProperties}
    >
      <div className="flex h-[100dvh] w-full font-sans text-slate-800 dark:text-slate-100 overflow-hidden relative bg-[#f8fafc] dark:bg-[#09090b] transition-colors duration-500">
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />

        {/* Animated Background Blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-25 dark:opacity-10 animate-blob" style={{ background: 'var(--theme-start)' }} />
          <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-25 dark:opacity-10 animate-blob animation-delay-2000" style={{ background: 'var(--theme-end)' }} />
        </div>

        {mobileMenuOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[190] lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

        {/* ===== SIDEBAR ===== */}
        <aside className={`fixed lg:relative top-0 left-0 w-[280px] h-full flex flex-col glass-panel border-r border-slate-200/50 dark:border-white/5 z-[200] lg:z-50 shrink-0 transform transition-transform duration-300 overflow-y-auto ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="p-6 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-[16px] inset-pill flex items-center justify-center shrink-0 font-black text-xl text-white shadow-md" style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}>
                    a4
                  </div>
                  <div>
                    <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white block">a4ai</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Institute Portal</span>
                  </div>
                </div>
                <button className="lg:hidden text-slate-500 inset-pill p-2 rounded-full" onClick={() => setMobileMenuOpen(false)}><Icons.X /></button>
              </div>

              <nav className="space-y-1.5">
                {navItems.map((item) => (
                  <SidebarButton key={item.id} active={activeTab === item.id} Icon={item.Icon} label={item.label} colorClass={item.color} badge={item.badge}
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} />
                ))}
              </nav>
            </div>

            <div className="pt-4">
              <div className="glass-panel rounded-[20px] p-4 text-center">
                <div className="w-9 h-9 rounded-[14px] inset-pill flex items-center justify-center mx-auto mb-2 text-indigo-500"><Icons.Shield /></div>
                <p className="font-black text-slate-900 dark:text-white text-xs">Verified Institute</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Secure AI Infrastructure</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ===== MAIN CONTENT AREA ===== */}
        <main className="flex-1 h-full overflow-y-auto relative z-10 scroll-smooth">
          <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto">

            {/* TOP HEADER */}
            <header className="sticky top-0 z-[100] bg-white/70 dark:bg-[#09090b]/70 backdrop-blur-xl border-b border-black/5 dark:border-white/5 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-4 mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button className="lg:hidden p-2.5 glass-panel rounded-[14px]" onClick={() => setMobileMenuOpen(true)}><Icons.Menu /></button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{institute?.name || "Institute Dashboard"}</h1>
                  <p className="text-xs text-slate-500 font-medium hidden sm:block">Manage your batches, teachers, and student access seamlessly.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center inset-pill rounded-full px-3 py-2 w-64">
                  <span className="text-slate-400 mr-2"><Icons.Search /></span>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members..."
                    className="bg-transparent outline-none text-xs font-bold text-slate-700 dark:text-white w-full placeholder-slate-400" />
                </div>

                <div className="relative" ref={profileRef}>
                  <button onClick={() => { setIsProfileOpen(!isProfileOpen); if (isProfileOpen) setShowAppearance(false); }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[20px] glass-panel transition-all active:scale-95">
                    <div className="w-8 h-8 rounded-[12px] flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}><Icons.User /></div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white hidden sm:inline">{displayName}</span>
                    <Icons.ChevronDown />
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 glass-overlay rounded-[24px] p-2 flex flex-col gap-1 animate-pop z-[150] shadow-2xl">
                      <div className="px-4 py-3 inset-pill rounded-[18px] mb-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}><Icons.User /></div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{displayName}</p>
                          <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                        </div>
                      </div>

                      <button onClick={(e) => { e.stopPropagation(); setShowAppearance(!showAppearance); }}
                        className="flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-[16px] transition-colors w-full">
                        <div className="flex items-center gap-2.5"><Icons.Sun /> Appearance & Theme</div>
                        <Icons.ChevronDown />
                      </button>

                      {showAppearance && (
                        <div className="px-4 py-2 space-y-3 bg-black/5 dark:bg-white/5 rounded-[16px] my-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Dark Mode</span>
                            <button onClick={() => setIsDarkMode(!isDarkMode)}
                              className={`w-10 h-6 rounded-full relative flex items-center px-1 transition-colors ${isDarkMode ? "bg-indigo-600" : "bg-slate-300"}`}>
                              <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${isDarkMode ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Theme Palette</span>
                            <div className="flex flex-wrap gap-2">
                              {(Object.keys(COLOR_SCHEMES) as Array<keyof typeof COLOR_SCHEMES>).map((key) => (
                                <button key={key} onClick={() => setActiveTheme(key)}
                                  className={`w-5 h-5 rounded-full shadow-sm transition-transform hover:scale-110 border-2 ${activeTheme === key ? "border-white scale-110" : "border-transparent"}`}
                                  style={{ background: COLOR_SCHEMES[key].start }} title={key} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                      <button onClick={handleLogout} className="flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-[16px] transition-colors"><Icons.LogOut /> Sign Out</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {isDemo && (
              <div className="mb-6 glass-panel rounded-[20px] px-5 py-3 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2 shadow-sm">
                <Icons.Sparkles /> Operating in Demo Mode. Connect your Supabase database tables to activate persistent storage.
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-24 text-slate-400 font-bold"><Icons.Loader /><span className="ml-2">Loading institute workspace...</span></div>
            ) : (
              <>
                {/* ===== OVERVIEW TAB ===== */}
                {activeTab === "overview" && (
                  <div className="space-y-6 animate-pop">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { t: "Active Students", v: studentCount, Icon: Icons.GradCap, color: "text-sky-500" },
                        { t: "Active Teachers", v: teacherCount, Icon: Icons.Users, color: "text-purple-500" },
                        { t: "Pending Requests", v: pendingCount, Icon: Icons.Clock, color: "text-amber-500" },
                        { t: "Active Tests", v: 8, Icon: Icons.FileText, color: "text-emerald-500" },
                      ].map((s, i) => {
                        const SIcon = s.Icon;
                        return (
                          <div key={i} className="glass-panel rounded-[28px] p-6 flex flex-col items-center text-center hover:-translate-y-1 transition-all shadow-sm">
                            <div className={`mb-3 inset-pill p-3 rounded-[18px] ${s.color}`}><SIcon /></div>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{s.v}</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.t}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Join Codes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <CodeCard role="student" code={institute?.student_code || ""} count={studentCount} copied={copied === "student"} onCopy={() => copy("student")} onRegen={() => regen("student")} />
                      <CodeCard role="teacher" code={institute?.teacher_code || ""} count={teacherCount} copied={copied === "teacher"} onCopy={() => copy("teacher")} onRegen={() => regen("teacher")} />
                    </div>

                    {/* Quick Management Panel */}
                    <div className="glass-panel rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Manual Member Onboarding</h3>
                        <p className="text-xs text-slate-500 font-medium">Manually provision student or teacher accounts using invite verification codes.</p>
                      </div>
                      <button onClick={() => setShowJoin(true)}
                        className="px-6 py-3.5 rounded-[20px] font-bold text-white btn-glossy-theme flex items-center gap-2 shadow-lg shrink-0">
                        <Icons.UserPlus /> Add Member
                      </button>
                    </div>
                  </div>
                )}

                {/* ===== STUDENTS / TEACHERS / PENDING ROSTERS ===== */}
                {activeTab !== "overview" && (
                  <div className="space-y-4 animate-pop">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white capitalize">
                        {activeTab === "pending" ? "Pending Onboarding Requests" : `${activeTab} Roster`} ({visible.length})
                      </h2>
                    </div>

                    {visible.length === 0 ? (
                      <div className="glass-panel rounded-[32px] p-12 text-center text-slate-400 font-bold">
                        No members found in this section.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visible.map((m) => (
                          <MemberRow key={m.id} member={m} onApprove={approve} onReject={reject} onRemove={removeMember} onGroup={setGroup} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        </main>
      </div>

      {showJoin && <JoinModal onClose={() => setShowJoin(false)} onJoin={join} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[300] glass-overlay px-5 py-3 rounded-[16px] text-xs font-black shadow-2xl animate-pop text-slate-900 dark:text-white border-l-4" style={{ borderColor: 'var(--theme-start)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}