// InstituteDashboardPage.tsx - Updated with HODAttendanceDashboard
// src/pages/institute/InstituteDashboardPage.tsx
// ──────────────────────────────────────────────────────────────────────
// a4ai — Institute admin dashboard  ·  ORANGE THEME  ·  3-column layout
// Full hierarchy: Institute → Departments → Sections → Batches → Students
// Roles: admin (full), hod (dept-lead), teacher
// Backward compatible: dept/section nullable, works without them
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import AssignTeacherModal from "@/components/institute/AssignTeacherModal";
import BulkStudentUpload from "@/components/institute/BulkStudentUpload";
import BatchManagementPanel from "@/components/admin/BatchManagementPanel";
import HODAttendanceDashboard from "@/components/attendance/HODAttendanceDashboard";

const InstituteAttendanceView = lazy(() => import("@/components/attendance/InstituteAttendanceView"));


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
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 100px; }

  .attendance-grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }
  @media (min-width: 640px) { .attendance-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .attendance-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1280px) { .attendance-grid { grid-template-columns: repeat(4, 1fr); } }

  @media (max-width: 640px) {
    .touch-target { min-height: 48px; min-width: 48px; }
    .field, .field-soft { font-size: 16px; padding: 14px 16px; }
  }

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

  .dept-accent { position: absolute; top:0; left:0; right:0; height: 3px; background: #FF7043; }

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
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  UserPlus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>,
  Layers: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>,
  Chart: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>,
  Settings: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Zap: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  Phone: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
  ChevronDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  Sun: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  Moon: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  Key: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>,
  LogOut: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>,
  Building: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></svg>,
  Rocket: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>,
  Share: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>,
  Sparkles: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>,
  Loader: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="anim-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>,
  Crown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" /></svg>,
  Filter: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
  Image: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
  Upload: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  Calendar: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
};

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
  const [creatingInstitute, setCreatingInstitute] = useState(false);
  const [newInstituteName, setNewInstituteName] = useState("");

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [assignBatch, setAssignBatch] = useState<{ id: string; name: string } | null>(null);
  const [isHod, setIsHod] = useState(false);
  const [hodDeptId, setHodDeptId] = useState<string | null>(null);
  const [assignTeacherBatches, setAssignTeacherBatches] = useState<{ teacherId: string; teacherName: string } | null>(null);
  const [teacherBatchMap, setTeacherBatchMap] = useState<Record<string, string[]>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceDateFilter, setAttendanceDateFilter] = useState(new Date().toISOString().slice(0,10));
  const [assignHodDept, setAssignHodDept] = useState<Department | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

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

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [search]);

  useEffect(() => {
    if (user) fetchData();
    else setLoading(false);
  }, [user]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (activeTab === "attendance" && institute) {
      fetchAttendance(attendanceDateFilter);
    }
  }, [activeTab, institute]);

  /* ─────────────────────────────────────────────────────────────
     FIXED: fetchData
     - Optional `id` param: agar diya gaya, to seedha usi institute ko load karo
     - Warna: pehle institutes (owner) check karo, phir institute_members
     ───────────────────────────────────────────────────────────── */
  const fetchData = async (explicitId?: string) => {
    setLoading(true);
    try {
      let id: string | null = explicitId || null;

      if (!id) {
        // 1. Owner check (institutes table)
        const { data: ownerData, error: ownerErr } = await supabase
          .from("institutes")
          .select("id")
          .eq("owner_id", user?.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!ownerErr && ownerData && ownerData.length > 0) {
          id = ownerData[0].id;
        } else {
          // 2. Member check (institute_members table)
          const { data: mData, error: memberError } = await supabase
            .from("institute_members")
            .select("institute_id, role, department_id")
            .eq("user_id", user?.id)
            .limit(1);

          if (memberError) console.error("Member lookup error:", memberError);

          if (mData && mData.length > 0) {
            id = mData[0].institute_id;
            if (mData[0].role === "hod" && mData[0].department_id) {
              setIsHod(true);
              setHodDeptId(mData[0].department_id);
            }
          }
        }
      }

      if (!id) {
        setInstitute(null);
        setLoading(false);
        return;
      }

      const [a, b, c, d, e, f] = await Promise.all([
        supabase.from("institutes").select("*").eq("id", id).single(),
        supabase.from("institute_members").select("*").eq("institute_id", id).eq("status", "active").in("role", ["teacher", "hod"]).order("joined_at", { ascending: false }),
        supabase.from("batches").select("*").eq("institute_id", id).eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("students").select("*, batches(name), student_access_codes(access_code)").eq("institute_id", id).eq("is_active", true).order("name", { ascending: true }),
        supabase.from("departments").select("*").eq("institute_id", id).order("name", { ascending: true }),
        supabase.from("sections").select("*, departments!inner(institute_id)").eq("departments.institute_id", id).order("name", { ascending: true }),
      ]);

      if (a.data) {
        setInstitute(a.data as Institute);
        const instId = a.data.id;
        try {
          const { data: logoData } = supabase.storage.from("institute-assets").getPublicUrl(`${instId}/logo`);
          const { data: bannerData } = supabase.storage.from("institute-assets").getPublicUrl(`${instId}/banner`);
          try {
            const logoRes = await fetch(logoData.publicUrl, { method: "HEAD" });
            if (logoRes.ok && logoRes.headers.get("content-type")?.startsWith("image")) {
              setLogoUrl(logoData.publicUrl + `?t=${Date.now()}`);
            }
          } catch { setLogoUrl(null); }
          try {
            const bannerRes = await fetch(bannerData.publicUrl, { method: "HEAD" });
            if (bannerRes.ok && bannerRes.headers.get("content-type")?.startsWith("image")) {
              setBannerUrl(bannerData.publicUrl + `?t=${Date.now()}`);
            }
          } catch { setBannerUrl(null); }
        } catch { /* ignore */ }
      }
      if (b.data) setTeachers(b.data as Teacher[]);
      if (c.data) setBatches(c.data as Batch[]);
      if (d.data) setStudents(d.data.map((s: any) => ({ ...s, batch_name: s.batches?.name || "Unassigned" })));
      if (e.data) setDepartments(e.data as Department[]);
      if (f.data) setSections(f.data as Section[]);

      const { data: tbData } = await supabase
        .from("teacher_batches")
        .select("teacher_id, batch_id")
        .eq("institute_id", id);
      const tbMap: Record<string, string[]> = {};
      tbData?.forEach((tb: any) => {
        if (!tbMap[tb.teacher_id]) tbMap[tb.teacher_id] = [];
        tbMap[tb.teacher_id].push(tb.batch_id);
      });
      setTeacherBatchMap(tbMap);
    } catch (err) {
      console.error("Data load error:", err);
      toast.error("Couldn't load your institute data");
    }
    setLoading(false);
  };

  /* ─────────────────────────────────────────────────────────────
     FIXED: handleCreateInstitute
     - RPC ka return value (UUID) seedha use karta hai
     - Success ke baad fetchData(newId) call karta hai — page reload ki zarurat nahi
     - Duplicate slug error ko friendly message mein convert karta hai
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

      // Agar RPC ne naya institute ID return kiya, usi ko load karo
      if (newId && typeof newId === "string") {
        await fetchData(newId);
      } else {
        // Fallback: normal fetch
        await fetchData();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create institute");
    }
    setCreatingInstitute(false);
  };

  const handleAddBatch = async () => {
    if (!newBatch.name.trim() || !institute) return;
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
      toast.success("Batch created!");
      setShowAddBatch(false);
      setNewBatch({ name: "", class_level: "", subject: "", description: "", department_id: "", section_id: "" });
      fetchData();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Delete this batch? Students stay, but lose their batch.")) return;
    const { error } = await supabase.from("batches").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Batch deleted");
    fetchData();
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
      fetchData();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeStudent = async (id: string) => {
    if (!confirm("Remove this student? Their attendance and submissions will also be deleted.")) return;
    await supabase.from("student_access_codes").delete().eq("student_id", id);
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student removed");
    fetchData();
  };

  const removeTeacher = async (id: string, userId?: string) => {
    if (!confirm("Remove this teacher from the institute? This cannot be undone.")) return;
    if (userId) await supabase.from("teacher_batches").delete().eq("teacher_id", userId);
    const { error } = await supabase.from("institute_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Teacher removed");
    fetchData();
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
      fetchData();
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
    fetchData();
  };

  const setTeacherDept = async (teacherId: string, deptId: string | null) => {
    const { error } = await supabase.from("institute_members")
      .update({ department_id: deptId }).eq("id", teacherId);
    if (error) return toast.error(error.message);
    toast.success("Department updated");
    fetchData();
  };

  const assignBatchToTeacher = async (teacherUserId: string, batchId: string) => {
    if (!institute) return;
    const { error } = await supabase.from("teacher_batches").insert({
      teacher_id: teacherUserId,
      batch_id: batchId,
      institute_id: institute.id,
    });
    if (error && error.code !== "23505") return toast.error(error.message);
    toast.success("Batch assigned!");
    fetchData();
  };

  const removeBatchFromTeacher = async (teacherUserId: string, batchId: string) => {
    if (!institute) return;
    const { error } = await supabase.from("teacher_batches")
      .delete()
      .eq("teacher_id", teacherUserId)
      .eq("batch_id", batchId);
    if (error) return toast.error(error.message);
    toast.success("Batch removed");
    fetchData();
  };

  const fetchAttendance = async (dateStr: string) => {
    if (!institute) return;
    setAttendanceLoading(true);
    try {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("institute_id", institute.id)
        .eq("date", dateStr);

      if (data) {
        const enriched = data.map((a: any) => {
          const batch = batches.find(b => b.id === a.batch_id);
          const teacher = teachers.find(t => t.user_id === a.marked_by);
          const records: Record<string, string> = a.records || {};
          const total = Object.keys(records).length;
          const present = Object.values(records).filter(v => v === "present").length;
          return {
            ...a,
            batch_name: batch?.name || "Unknown",
            teacher_name: teacher?.user_name || teacher?.user_email || "—",
            total,
            present,
            absent: total - present,
            pct: total > 0 ? Math.round((present / total) * 100) : 0,
          };
        });
        setAttendanceRecords(enriched);
      }
    } catch (e) { console.error(e); }
    setAttendanceLoading(false);
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
      a.download = `student_access_codes_${new Date().toISOString().slice(0,10)}.csv`;
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
      fetchData();
    } catch (e: any) { toast.error(e.message || "Failed — check RLS policy"); }
  };

  const deleteDept = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? Sections in it will also be deleted. Teachers/batches/students will lose their dept but stay.`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`${name} deleted`);
    if (expandedDept === id) setExpandedDept(null);
    fetchData();
  };

  const regenDeptCode = async (deptId: string, deptName: string, kind: "student_code" | "teacher_code") => {
    if (!confirm("Regenerate this code? Old code will stop working.")) return;
    try {
      const code = makeDeptCode(deptName, kind === "student_code" ? "STU" : "TCH");
      const { error } = await supabase.from("departments").update({ [kind]: code }).eq("id", deptId);
      if (error) throw error;
      toast.success("New code generated");
      fetchData();
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
      fetchData();
    } catch (e: any) { toast.error(e.message || "Failed to create section"); }
  };

  const deleteSection = async (id: string, name: string) => {
    if (!confirm(`Delete section ${name}? Members in it will lose the section but stay.`)) return;
    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`${name} deleted`);
    fetchData();
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
      await fetchData();
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
      setInstitute({ ...institute, name: editNameValue.trim() });
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
      const { error } = await supabase.storage.from("institute-assets").upload(`${institute.id}/logo`, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("institute-assets").getPublicUrl(`${institute.id}/logo`);
      setLogoUrl(data.publicUrl + `?t=${Date.now()}`);
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
      const { error } = await supabase.storage.from("institute-assets").upload(`${institute.id}/banner`, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("institute-assets").getPublicUrl(`${institute.id}/banner`);
      setBannerUrl(data.publicUrl + `?t=${Date.now()}`);
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
  const totalStudents = students.length;
  const totalBatches = batches.length;
  const totalDepartments = departments.length;
  const totalSections = sections.length;
  const activeTeachers = teachers.filter(t => t.status === "active").length;
  const maxStudents = institute?.max_students || 0;
  const maxTeachers = institute?.max_teachers || 0;
  const studentPct = maxStudents ? Math.min(totalStudents / maxStudents, 1) : 0;
  const teacherPct = maxTeachers ? Math.min(totalTeachersAll / maxTeachers, 1) : 0;
  const batchPct = totalBatches ? Math.min(totalBatches / 10, 1) : 0;
  const unassigned = students.filter(s => !s.batch_id).length;
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
    let list = students.filter(s => matchesDept(s.department_id) && matchesSection(s.section_id));
    if (!q) return list;
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.roll_no || "").toLowerCase().includes(q) ||
      (s.batch_name || "").toLowerCase().includes(q)
    );
  }, [students, debouncedSearch, deptFilter, sectionFilter]);

  const batchChart = useMemo(() =>
    batches.slice(0, 12).map((b) => ({
      label: b.class_level ? `C${b.class_level}` : b.name.slice(0, 5),
      value: students.filter(s => s.batch_id === b.id).length,
    })), [batches, students]);

  const sectionsOfDept = (deptId: string) => sections.filter(s => s.department_id === deptId);
  const teachersOfDept = (deptId: string) => teachers.filter(t => t.department_id === deptId);
  const batchesOfDept = (deptId: string) => batches.filter(b => b.department_id === deptId);
  const studentsOfDept = (deptId: string) => students.filter(s => s.department_id === deptId);
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

  const navItems = [
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
            <button onClick={() => setShowAddStudent(true)} title="Add student" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.UserPlus /></button>
            <button onClick={() => setShowAddBatch(true)} title="New batch" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Layers /></button>
            <button onClick={() => setShowAddDept(true)} title="New department" className="p-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#FFF5F2] hover:text-[#FF7043] transition-colors"><Icons.Building /></button>
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className={`px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mx-auto w-full ${activeTab === "attendance" ? "max-w-7xl" : "max-w-5xl"}`}>

          <div className="flex items-center gap-2 mb-4 lg:hidden">
            <button className="p-2 -ml-2 text-slate-500 touch-target" onClick={() => setMobileMenuOpen(true)}><Icons.Menu /></button>
            <button onClick={goHome} title="Back to home" className="p-2 rounded-lg bg-[#FFF5F2] text-[#FF7043]"><Icons.Home /></button>
            <span className="text-lg font-black text-slate-900 truncate">{institute.name}</span>
          </div>

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
                  onChange={e => { setSearch(e.target.value); if (e.target.value && activeTab !== "students") setActiveTab("students"); }}
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
                    <button onClick={() => setShowAddBatch(true)} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]">Create Batch</button>
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

                          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Icons.Crown /></div>
                            <div className="flex-1 min-w-0">
                              {dHod ? (
                                <>
                                  <p className="text-[13px] font-bold text-slate-800 truncate">{dHod.user_name || dHod.user_email || `Teacher ${dHod.user_id.slice(0, 8)}`}</p>
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
                {departments.length > 0 && <p className="text-[11px] text-slate-400 font-medium mt-3">Tip: use department-specific codes from the Departments tab to auto-assign teachers to a department.</p>}
              </div>

              {departments.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icons.Filter /> Filter:</span>
                  <button onClick={() => setDeptFilter("")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                  <button onClick={() => setDeptFilter("none")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "none" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Unassigned</button>
                  {departments.map(d => (
                    <button key={d.id} onClick={() => setDeptFilter(d.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === d.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.name}</button>
                  ))}
                </div>
              )}

              {filteredTeachers.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center card-shadow border border-slate-50">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3"><Icons.Users /></div>
                  <p className="text-sm text-slate-500 font-medium">{teachers.length === 0 ? "No teachers yet. Share the join code above." : "No teachers match this filter."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTeachers.map(t => (
                    <React.Fragment key={t.id}>
                    <div className="bg-white rounded-2xl p-4 flex flex-wrap items-center gap-3 card-shadow border border-slate-50 anim-row">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.role === "hod" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-500"}`}>
                        {t.role === "hod" ? <Icons.Crown /> : <Icons.User />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{t.user_name || t.user_email || `Teacher ${t.user_id.slice(0, 8)}`}</p>
                          {t.role === "hod" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 inline-flex items-center gap-1"><Icons.Crown /> HOD</span>}
                          {t.department_id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-600">{deptName(t.department_id)}</span>}
                        </div>
                        <p className="text-[11px] font-medium text-slate-400">{t.joined_at ? `Joined ${fmtDate(t.joined_at)}` : "Pending"}</p>
                      </div>
                      {departments.length > 0 && (
                        <select
                          value={t.department_id || ""}
                          onChange={e => { e.stopPropagation(); setTeacherDept(t.id, e.target.value || null); }}
                          className="text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-[#FF7043]"
                          title="Change department"
                          onClick={e => e.stopPropagation()}
                        >
                          <option value="">No dept</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setAssignTeacherBatches({ teacherId: t.user_id, teacherName: t.user_name || t.user_email || "Teacher" }); }}
                        className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                        title="Assign batches to this teacher"
                      >
                        📚 Batches ({(teacherBatchMap[t.user_id] || []).length})
                      </button>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${t.status === "active" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>{t.status}</span>
                      <button onClick={e => { e.stopPropagation(); removeTeacher(t.id, t.user_id); }} title="Remove teacher" className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                    </div>
                    {(teacherBatchMap[t.user_id] || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-4 pb-2 -mt-2">
                        {(teacherBatchMap[t.user_id] || []).map(bid => {
                          const b = batches.find(x => x.id === bid);
                          return b ? (
                            <span key={bid} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              📚 {b.name}
                              <button onClick={() => removeBatchFromTeacher(t.user_id, bid)} className="text-indigo-400 hover:text-red-500 ml-0.5">×</button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STUDENTS TAB ── */}
          {activeTab === "students" && (
            <div className="anim-entrance" style={{ animationDelay: "0.05s" }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-[13px] text-slate-500 font-bold">{search || deptFilter || sectionFilter ? `${filteredStudents.length} match${filteredStudents.length !== 1 ? "es" : ""}` : `${totalStudents} total`}</p>
                <div className="flex gap-2">
                  <button onClick={downloadAccessCodesCSV} className="btn-ghost px-4 py-2.5 rounded-xl text-[13px]" title="Download access codes CSV for parents">📥 Access Codes CSV</button>
                  <button onClick={() => setShowBulkUpload(true)} className="btn-ghost px-4 py-2.5 rounded-xl text-[13px]"><Icons.Upload /> Bulk Upload</button>
                  <button onClick={() => setShowAddStudent(true)} className="btn-orange px-5 py-2.5 rounded-xl text-[13px]"><Icons.Plus /> Add Student</button>
                </div>
              </div>

              {departments.length > 0 && (
                <div className="space-y-2 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icons.Filter /> Dept:</span>
                    <button onClick={() => { setDeptFilter(""); setSectionFilter(""); }} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                    <button onClick={() => { setDeptFilter("none"); setSectionFilter(""); }} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "none" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Unassigned</button>
                    {departments.map(d => (
                      <button key={d.id} onClick={() => { setDeptFilter(d.id); setSectionFilter(""); }} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === d.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.name}</button>
                    ))}
                  </div>
                  {availSectionsForFilter.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icons.Layers /> Section:</span>
                      <button onClick={() => setSectionFilter("")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${sectionFilter === "" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                      {availSectionsForFilter.map(s => (
                        <button key={s.id} onClick={() => setSectionFilter(s.id)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${sectionFilter === s.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{s.name}{s.year ? ` · Y${s.year}` : ""}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {filteredStudents.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center card-shadow border border-slate-50">
                  <div className="w-12 h-12 rounded-full bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mx-auto mb-3"><Icons.User /></div>
                  <p className="text-sm text-slate-500 font-medium">{students.length === 0 ? "No students enrolled yet." : "No students match those filters."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStudents.map(s => (
                    <div key={s.id} onClick={() => navigate(`/institute/students/${s.id}`)} className="bg-white rounded-2xl p-4 flex flex-wrap items-center gap-3 card-shadow border border-slate-50 anim-row cursor-pointer hover:border-[#FF7043]/30 hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center font-bold text-sm shrink-0">{getInitials(s.name)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{s.name}</p>
                          {s.department_id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-600">{deptName(s.department_id)}</span>}
                          {s.section_id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600">{sectionName(s.section_id)}</span>}
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 truncate">{s.batch_name} · Roll {s.roll_no || "N/A"}{s.parent_phone ? ` · ${s.parent_phone}` : ""}{(s as any).student_access_codes?.[0]?.access_code ? ` · 🔑 ${(s as any).student_access_codes[0].access_code}` : ""}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 shrink-0">Class {s.class_level || "—"}</span>
                      <button onClick={(e) => { e.stopPropagation(); contactParent(s); }} title="Message parent" className="p-2 rounded-lg text-slate-300 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors"><Icons.Phone /></button>
                      <button onClick={(e) => { e.stopPropagation(); removeStudent(s.id); }} title="Remove student" className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                    </div>
                  ))}
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
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icons.Filter /> Dept:</span>
                  <button onClick={() => { setDeptFilter(""); setSectionFilter(""); }} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                  <button onClick={() => { setDeptFilter("none"); setSectionFilter(""); }} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === "none" ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Unassigned</button>
                  {departments.map(d => (
                    <button key={d.id} onClick={() => { setDeptFilter(d.id); setSectionFilter(""); }} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${deptFilter === d.id ? "bg-[#FF7043] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.name}</button>
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
                    const count = students.filter(s => s.batch_id === b.id).length;
                    return (
                      <div key={b.id} className="bg-white rounded-2xl p-5 card-shadow card-hover border border-slate-50 relative group anim-row">
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setAssignBatch({ id: b.id, name: b.name })} title="Assign teacher" className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF7043] hover:bg-[#FFF5F2] transition-colors"><Icons.UserPlus /></button>
                          <button onClick={() => deleteBatch(b.id)} title="Delete batch" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Icons.Trash /></button>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-[#FFF5F2] text-[#FF7043] flex items-center justify-center mb-3"><Icons.Layers /></div>
                        <h4 className="text-[14px] font-bold text-slate-800">{b.name}</h4>
                        <p className="text-[12px] font-medium text-slate-400 mb-3">{b.class_level ? `Class ${b.class_level}` : "No class set"}{b.subject ? ` · ${b.subject}` : ""}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{count} student{count !== 1 ? "s" : ""}</span>
                          {b.department_id && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-600">{deptName(b.department_id)}</span>}
                          {b.section_id && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-600">{sectionName(b.section_id)}</span>}
                        </div>
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
              <HODAttendanceDashboard instituteId={institute.id} />
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
                <BatchManagementPanel instituteId={institute.id} />
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

      {assignTeacherBatches && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAssignTeacherBatches(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Assign Batches</h3>
              <button onClick={() => setAssignTeacherBatches(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Teacher: <strong>{assignTeacherBatches.teacherName}</strong></p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {batches.map(b => {
                const isAssigned = (teacherBatchMap[assignTeacherBatches.teacherId] || []).includes(b.id);
                return (
                  <div key={b.id}
                    className={"flex items-center justify-between p-3 rounded-xl border transition-colors " + (isAssigned ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200")}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{b.name}</p>
                      <p className="text-xs text-slate-400">{b.class_level ? "Class " + b.class_level : ""} {b.department_id ? "· " + deptName(b.department_id) : ""}</p>
                    </div>
                    <button
                      onClick={() => isAssigned ? removeBatchFromTeacher(assignTeacherBatches.teacherId, b.id) : assignBatchToTeacher(assignTeacherBatches.teacherId, b.id)}
                      className={"px-4 py-1.5 rounded-lg text-xs font-bold transition-colors " + (isAssigned ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-indigo-500 text-white hover:bg-indigo-600")}
                    >
                      {isAssigned ? "Remove" : "Assign"}
                    </button>
                  </div>
                );
              })}
              {batches.length === 0 && <p className="text-center text-slate-400 py-4">No batches created yet</p>}
            </div>
          </div>
        </div>
      )}

      {showBulkUpload && (
        <BulkStudentUpload
          instituteId={institute.id}
          batches={batches}
          departments={departments}
          sections={sections}
          onUploadComplete={fetchData}
          onClose={() => setShowBulkUpload(false)}
        />
      )}
    </div>
  );
}