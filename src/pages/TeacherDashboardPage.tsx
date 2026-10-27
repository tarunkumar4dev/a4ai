// TeacherDashboardPage.tsx - Updated (removed batch-settings from navItems)
import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StaticSarthi from "@/components/chat/StaticSarthi";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import ProctorSectionView, { useProctorCheck } from "@/components/attendance/ProctorSectionView";
import { downloadTestDocument, fetchQuestionsForTest, type TestQuestionData } from "@/utils/testPdfExporter";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type TestLinkInfo, testLinks } from "@/lib/uploadLink/testLink";

// Each tab is its own chunk: opening the dashboard downloads only what the
// first screen needs; a tab's code is fetched the first time it is opened.
const AttendancePage = lazy(() => import("@/components/attendance/AttendancePage"));
const InstituteTeacherPanel = lazy(() => import("@/components/institute/InstituteTeacherPanel"));
const TeacherAssignmentsTab = lazy(() => import("@/components/teacher/TeacherAssignmentsTab"));
const WorksheetGenerator = lazy(() => import("@/components/teacher/WorksheetGenerator"));
const TeacherCalendarTab = lazy(() => import("@/components/teacher/TeacherCalendarTab"));
const TeacherStudentsTab = lazy(() => import("@/components/teacher/TeacherStudentsTab"));
const TeacherAnalyticsTab = lazy(() => import("@/components/teacher/TeacherAnalyticsTab"));
const CheckingLinkModal = lazy(() =>
  import("@/components/teacher/copySubmissions/CheckingLink").then((m) => ({ default: m.CheckingLinkModal })),
);
const TabFallback = () => (
  <div className="flex justify-center py-16">
    <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-slate-500 animate-spin" />
  </div>
);


/* ------------------- STYLES ------------------- */
const customStyles = `

  .dashboard-root {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    background-color: #F8F9FA;
  }
  .dark .dashboard-root {
    background-color: #0A0A0A;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes bounceBadge {
    0%, 100% { transform: translateY(0); }
    50%        { transform: translateY(-3px); }
  }
  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)  scale(1); }
  }
  @keyframes pulseRed {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  }

  .btn-join-black {
    background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%) !important;
    box-shadow: inset 0px 2px 4px rgba(255,255,255,0.1), inset 0px -2px 4px rgba(0,0,0,0.6), 0px 8px 20px rgba(0,0,0,0.3) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: white !important;
  }
  .btn-join-black:hover {
    filter: brightness(1.2) !important;
    transform: translateY(-2px) !important;
  }
  .btn-join-black .text-white\/50 {
    color: rgba(255,255,255,0.5) !important;
  }

  /* ── Auto-Moving Background Blobs ── */
  @keyframes blobBounce {
    0%   { transform: translate(0px, 0px) scale(1); }
    33%  { transform: translate(30px, -50px) scale(1.1); }
    66%  { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-blob { 
    animation: blobBounce 15s infinite ease-in-out alternate; 
  }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }

  .animate-entrance { animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
  .animate-pop      { animation: scaleIn  0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-drop     { animation: dropIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-mic-pulse { animation: pulseRed 1.5s infinite; }

  /* ── Scroll-reveal ── */
  .scroll-reveal {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .scroll-reveal.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .shimmer-text {
    background: linear-gradient(90deg, var(--theme-end) 0%, var(--theme-start) 50%, var(--theme-end) 100%);
    background-size: 200% 100%;
    animation: shimmer 2.4s infinite;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .new-badge { animation: bounceBadge 1.2s ease infinite; }
  .search-dropdown { animation: dropIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  ::-webkit-scrollbar        { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track  { background: transparent; }
  ::-webkit-scrollbar-thumb  { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
  .dark ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }

  .glass-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-panel {
    background: rgba(18, 18, 18, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }
  .glass-overlay {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(48px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-overlay {
    background: rgba(12, 12, 12, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.9);
  }
  .inset-pill {
    background: rgba(255, 255, 255, 0.9);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.02),
                inset -4px -4px 10px rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  .dark .inset-pill {
    background: rgba(24, 24, 24, 0.9);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.5),
                inset -4px -4px 10px rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .btn-glossy-theme {
    background: linear-gradient(135deg, var(--theme-start) 0%, var(--theme-end) 100%);
    box-shadow: inset 0px 2px 4px rgba(255, 255, 255, 0.25),
                inset 0px -2px 4px rgba(0, 0, 0, 0.4),
                0px 8px 20px var(--theme-shadow);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    position: relative;
    overflow: hidden;
    font-weight: 700;
  }
  .btn-glossy-theme::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }
  .btn-glossy-theme:hover::before  { left: 100%; }
  .btn-glossy-theme:hover  { filter: brightness(1.15); transform: translateY(-2px); }
  .btn-glossy-theme:active { transform: translateY(0); filter: brightness(0.9); }

  .btn-startups {
    background: linear-gradient(135deg, var(--theme-start) 0%, var(--theme-end) 100%);
    box-shadow: inset 0px 2px 4px rgba(255, 255, 255, 0.25),
                inset 0px -2px 4px rgba(0, 0, 0, 0.4),
                0px 8px 20px var(--theme-shadow);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    position: relative;
    overflow: hidden;
    font-weight: 700;
  }
  .btn-startups::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
    transition: left 0.5s ease;
  }
  .btn-startups:hover::before  { left: 100%; }
  .btn-startups:hover  { filter: brightness(1.15); transform: translateY(-2px); }
  .btn-startups:active { transform: translateY(0); filter: brightness(0.9); }

  .folder-paper { fill: #F1F5F9; stroke: #CBD5E1; stroke-width: 2; }
  .dark .folder-paper { fill: #222222; stroke: #444444; }

  @keyframes typingDot {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30%           { transform: translateY(-3px); opacity: 1; }
  }
  .typing-dot { animation: typingDot 1s infinite; }

  /* ── Stat numbers ── */
  .stat-number {
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .join-code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    letter-spacing: .2em;
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-blob, .new-badge, .typing-dot { animation: none !important; }
  }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Grid: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="2" /><rect width="7" height="7" x="14" y="3" rx="2" /><rect width="7" height="7" x="14" y="14" rx="2" /><rect width="7" height="7" x="3" y="14" rx="2" /></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  FileText: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>,
  Brain: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" /></svg>,
  Zap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>,
  ChevronDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>,
  Trophy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>,
  Clock: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  GradCap: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>,
  Mail: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Menu: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>,
  Moon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>,
  Sun: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  LogOut: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>,
  Send: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>,
  Globe: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" /></svg>,
  Youtube: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></svg>,
  Sparkles: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3L8 5 6 7 4 5 6 3Z" /><path d="M18 13L20 15 18 17 16 15 18 13Z" /><path d="M10 7L13 10 13 10 7 10 10 7Z" /><path d="m13 17 2 3 2-3" /><path d="M18 3v4" /><path d="M20 5h-4" /></svg>,
  Star: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  Book: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>,
  Microphone: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" x2="12" y1="19" y2="22" /></svg>,
  FolderOpen: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><path d="M6 11h12" /></svg>,
  Calendar: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
};

/* ------------------- THEME COLORS ------------------- */
const COLOR_SCHEMES = {
  orange: { start: '#FF6B35', end: '#E85A28', shadow: 'rgba(255,107,53,0.35)' },
  black: { start: '#333333', end: '#000000', shadow: 'rgba(0,0,0,0.4)' },
  maroon: { start: '#A52A2A', end: '#800000', shadow: 'rgba(128,0,0,0.4)' },
  magenta: { start: '#DB2777', end: '#8B008B', shadow: 'rgba(139,0,139,0.4)' },
  teal: { start: '#20B2AA', end: '#008080', shadow: 'rgba(0,128,128,0.4)' },
  darkYellow: { start: '#DAA520', end: '#B8860B', shadow: 'rgba(184,134,11,0.4)' },
  darkGreen: { start: '#228B22', end: '#006400', shadow: 'rgba(0,100,0,0.4)' },
  darkPurple: { start: '#8A2BE2', end: '#4B0082', shadow: 'rgba(75,0,130,0.4)' },
  crimsonRed: { start: '#DC143C', end: '#8B0000', shadow: 'rgba(139,0,0,0.4)' },
};

/* ------------------- REUSABLE COMPONENTS ------------------- */
const SidebarButton = ({ active, Icon, label, colorClass, badge, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-start px-4 sm:px-5 py-3 sm:py-3.5 rounded-[12px] font-bold text-sm transition-all duration-300 ${active
      ? "bg-slate-200/50 dark:bg-slate-800 shadow-sm text-slate-800 dark:text-white"
      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      }`}
  >
    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
      <div className={`${active ? "scale-110" : ""} transition-transform shrink-0 ${colorClass || "text-slate-500"}`}>
        {Icon ? <Icon /> : null}
      </div>
      <span className="truncate tracking-wide">{label}</span>
      {badge && (
        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs shrink-0">
          {badge}
        </span>
      )}
    </div>
  </button>
);

const GlossyButton = ({
  icon: Icon,
  label,
  subLabel,
  onClick,
  fullWidth = false,
  small = false,
  showNewBadge = false,
  isStartupsStyle = false,
  disabled = false,
}: any) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`relative flex items-center justify-start gap-3 rounded-[22px] ${disabled
      ? "opacity-60 cursor-not-allowed filter grayscale"
      : "hover:-translate-y-1"
      } ${isStartupsStyle ? "btn-startups" : "btn-glossy-theme"
      } ${fullWidth ? "w-full" : "w-auto"
      } ${small
        ? "px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[48px]"
        : "px-4 sm:px-5 py-3.5 min-h-[60px] text-[15px] sm:text-base"
      } overflow-hidden group`}
  >
    {Icon && (
      <div
        className={`flex items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md ${small ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8 sm:h-10 sm:w-10"} border border-white/40 shadow-inner  transition-transform shrink-0`}
      >
        <Icon size={small ? 14 : 18} />
      </div>
    )}
    <div className="flex flex-1 flex-col text-left min-w-0">
      <span className="font-bold leading-tight tracking-tight flex flex-wrap items-center gap-x-2 gap-y-1 text-white">
        {label}
        {showNewBadge && (
          <span className="new-badge bg-white/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-white">
            NEW
          </span>
        )}
      </span>
      {subLabel && !small && (
        <span className="mt-1 text-xs font-medium leading-snug text-white/85">{subLabel}</span>
      )}
    </div>
    {!small && (
      <div className={`ml-auto pl-2 sm:pl-4 text-white/50  transition-transform shrink-0`}>
        <Icons.ChevronRight />
      </div>
    )}
  </button>
);

/* ------------------- SEARCH BAR ------------------- */
interface SavedTest {
  id: string;
  exam_title: string;
  board: string;
  class_grade: string;
  subject: string;
  status: string;
  total_questions: number;
  total_marks: number;
  created_at: string;
}

interface Suggestion {
  type: "test" | "nav" | "tool";
  label: string;
  sub: string;
  Icon: React.ComponentType;
  action: () => void;
}

function SearchBar({
  tests,
  onNavChange,
}: {
  tests: SavedTest[];
  onNavChange: (tab: string) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const staticSuggestions: Suggestion[] = [
    { type: "nav", label: "Dashboard", sub: "Overview & stats", Icon: Icons.Grid, action: () => { navigate("/dashboard"); onNavChange("dashboard"); } },
    { type: "nav", label: "Students", sub: "Manage your class", Icon: Icons.Users, action: () => onNavChange("students") },
    { type: "nav", label: "Modules", sub: "Manage your modules", Icon: Icons.FolderOpen, action: () => onNavChange("modules") },
    { type: "nav", label: "Test History", sub: "All your tests", Icon: Icons.History, action: () => onNavChange("tests") },
    { type: "nav", label: "Analytics", sub: "Performance graphs", Icon: Icons.Chart, action: () => onNavChange("analytics") },
    { type: "nav", label: "AI Tools", sub: "Teaching utilities", Icon: Icons.Brain, action: () => onNavChange("ai-tools") },
    { type: "tool", label: "AI Paper Checker", sub: "Grade answer sheets & tests", Icon: Icons.Sparkles, action: () => navigate("/dashboard/test-generator?tab=check") },
    { type: "tool", label: "Community Quiz", sub: "From YouTube video", Icon: Icons.Youtube, action: () => navigate("/teacher/community-quiz/new") },
    { type: "tool", label: "Create Test", sub: "Test generator", Icon: Icons.Zap, action: () => navigate("/dashboard/test-generator") },
    { type: "tool", label: "Host Contest", sub: "Live competition", Icon: Icons.Trophy, action: () => navigate("/contests") },
    { type: "tool", label: "Pricing / Plans", sub: "Buy Premium", Icon: Icons.Star, action: () => navigate("/pricing") },
  ];

  const suggestions: Suggestion[] =
    query.trim().length < 1
      ? []
      : [
        ...tests
          .filter(
            (t) =>
              (t.exam_title?.toLowerCase() || "").includes(query.toLowerCase()) ||
              (t.subject?.toLowerCase() || "").includes(query.toLowerCase()) ||
              (t.class_grade?.toLowerCase() || "").includes(query.toLowerCase())
          )
          .slice(0, 3)
          .map<Suggestion>((t) => ({
            type: "test",
            label: t.exam_title || "Untitled Test",
            sub: `Class ${t.class_grade} · ${t.subject} · ${t.board}`,
            Icon: Icons.FileText,
            action: () => onNavChange("tests"),
          })),
        ...staticSuggestions.filter(
          (s) =>
            s.label.toLowerCase().includes(query.toLowerCase()) ||
            s.sub.toLowerCase().includes(query.toLowerCase())
        ),
      ].slice(0, 7);

  const handleSelect = (s: Suggestion) => {
    s.action();
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center inset-pill rounded-full p-1.5 w-full lg:w-72 focus-within:ring-2 focus-within:ring-slate-400/40 transition-all duration-200">
        <div className="pl-3 text-slate-500 dark:text-slate-400 shrink-0">
          <Icons.Search />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tests, tools..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-white px-2 placeholder-slate-400"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="pr-3 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <Icons.X />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          ref={dropRef}
          className="search-dropdown absolute top-full mt-3 left-0 w-full sm:w-80 glass-overlay rounded-[28px] p-2 z-[200] shadow-2xl"
        >
          {suggestions.map((s, i) => {
            const SuggestionIcon = s.Icon;
            return (
              <button
                key={i}
                onClick={() => handleSelect(s)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[20px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
              >
                <div
                  className={`p-2 rounded-[14px] inset-pill border-none shrink-0 ${s.type === "test"
                    ? "text-slate-800 dark:text-slate-200"
                    : s.type === "tool"
                      ? "text-slate-500 dark:text-slate-400"
                      : "text-slate-700 dark:text-slate-300"
                    }`}
                >
                  <SuggestionIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-slate-600 transition-colors">
                    {s.label}
                  </p>
                  <p className="text-xs text-slate-500 font-medium truncate">{s.sub}</p>
                </div>
                <div className="ml-auto text-slate-400 shrink-0">
                  <Icons.ChevronRight />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------- SUBSCRIPTION & HELP WIDGETS ------------------- */
function SubscriptionSidebarWidget({ navigate, testsCount = 0 }: { navigate: any; testsCount?: number }) {
  const { status } = useSubscription();

  const isPro = status?.plan_slug === "pro";
  const used = Math.max(status?.tests_used || 0, testsCount);
  const limit = status?.test_limit || 10;
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileWidth = window.innerWidth < 768;
      const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileWidth || isMobileAgent);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-[32px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none border border-slate-100 dark:border-white/5 mb-6 text-center flex flex-col items-center relative overflow-hidden">
      <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-600 shrink-0">
        <div className="text-slate-800 dark:text-slate-200">
          <Icons.Zap />
        </div>
      </div>

      <h4 className="text-slate-900 dark:text-white font-extrabold text-lg mb-1 tracking-tight">
        {status?.plan_name || "Free Plan"}
      </h4>
      <p className="text-slate-500 dark:text-slate-400 text-[13px] font-medium mb-4">
        {used}/{limit} tests used
      </p>
      {status?.plan_slug !== "free" && status?.subscription_expires && (
        <p className="text-slate-400 dark:text-slate-500 text-[12px] font-medium -mt-3 mb-4">
          Valid till{" "}
          {new Date(status.subscription_expires).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}

      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {!isPro && (
        <GlossyButton
          label={isMobile ? "Coming Soon" : "Upgrade"}
          small
          fullWidth
          disabled={isMobile}
          onClick={() => {
            if (isMobile) {
              return;
            }
            navigate("/pricing");
          }}
        />
      )}
    </div>
  );
}

function SidebarHelpWidget() {
  return (
    <div className="pt-2 pb-4 px-4 flex flex-col items-center text-center relative z-10">
      <div className="w-28 h-28 relative mb-2 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl overflow-visible">
          <rect x="25" y="15" width="40" height="50" rx="2" className="folder-paper" transform="rotate(-15 45 40)" />
          <line x1="30" y1="25" x2="55" y2="25" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" transform="rotate(-15 45 40)" />
          <line x1="30" y1="32" x2="50" y2="32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" transform="rotate(-15 45 40)" />
          <rect x="35" y="15" width="45" height="55" rx="2" className="folder-paper" transform="rotate(10 55 40)" />
          <circle cx="58" cy="35" r="8" fill="#E2E8F0" transform="rotate(10 55 40)" />
          <path d="M58 27 A8 8 0 0 1 66 35 L58 35 Z" fill="#94A3B8" transform="rotate(10 55 40)" />
          <rect x="40" y="10" width="35" height="50" rx="2" className="folder-paper" />
          <line x1="45" y1="20" x2="70" y2="20" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
          <line x1="45" y1="26" x2="65" y2="26" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
          <line x1="45" y1="32" x2="70" y2="32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 40 C15 35 18 32 23 32 L40 32 L48 40 L85 40 C90 40 93 43 93 48 L93 85 C93 90 90 93 85 93 L23 93 C18 93 15 90 15 85 Z" fill="var(--theme-end)" />
          <path d="M12 48 C12 43 15 40 20 40 L45 40 L53 48 L88 48 C93 48 96 51 96 56 L90 88 C89 92 85 95 80 95 L20 95 C15 95 11 92 10 88 Z" fill="var(--theme-start)" />
        </svg>
      </div>

      <h4 className="font-extrabold text-[15px] text-slate-800 dark:text-white mb-0.5 tracking-tight">Need help?</h4>
      <p className="text-[11px] text-slate-500 font-medium mb-4">Please check our docs</p>

      <button
        onClick={() => window.open("https://www.a4ai.in/docs", "_blank")}
        className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl py-2.5 text-[13px] font-bold mb-3 transition-colors shadow-sm flex items-center justify-center gap-2"
      >
        📚 Documentation
        <span className="text-[10px] text-slate-500 dark:text-slate-400">↗</span>
      </button>
    </div>
  );
}

/* ------------------- TEST HISTORY COMPONENT ------------------- */
function TestHistory({
  onCreateNew,
  tests,
  loading,
  user,
}: {
  onCreateNew: () => void;
  tests: SavedTest[];
  loading: boolean;
  user: any;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "saved" | "draft">("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingType, setDownloadingType] = useState<"paper" | "key" | "docx" | null>(null);
  const navigateTo = useNavigate();

  // Preview Modal State
  const [previewTest, setPreviewTest] = useState<SavedTest | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<TestQuestionData[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState<"paper" | "key">("paper");

  // "📸 Checking Link" (upload link for students' copies) per saved test
  const [linkTest, setLinkTest] = useState<SavedTest | null>(null);
  const [links, setLinks] = useState<Record<string, TestLinkInfo[]>>({});
  const savedIds = tests.filter(t => t.status === "saved").map(t => t.id).join(",");
  useEffect(() => {
    if (!savedIds) return;
    testLinks(savedIds.split(",")).then(setLinks).catch(() => setLinks({}));
  }, [savedIds]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Recent";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const statusColor = (status: string) => {
    if (status === "saved")
      return "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60";
    if (status === "draft")
      return "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60";
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400";
  };

  const handleDownload = async (
    t: SavedTest,
    format: "pdf" | "docx",
    isAnswerKey: boolean
  ) => {
    setDownloadingId(t.id);
    setDownloadingType(isAnswerKey ? "key" : format === "docx" ? "docx" : "paper");
    try {
      await downloadTestDocument({
        test: {
          id: t.id,
          exam_title: t.exam_title,
          board: t.board,
          class_grade: t.class_grade,
          subject: t.subject,
          status: t.status,
          total_questions: t.total_questions,
          total_marks: t.total_marks,
          created_at: t.created_at,
          teacher_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher",
        },
        format,
        isAnswerKey,
        teacherId: user?.id,
      });
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to download document. Please try again.");
    } finally {
      setDownloadingId(null);
      setDownloadingType(null);
    }
  };

  const handleOpenPreview = async (t: SavedTest) => {
    setPreviewTest(t);
    setPreviewLoading(true);
    setPreviewTab("paper");
    try {
      const qs = await fetchQuestionsForTest(t.id, user?.id);
      setPreviewQuestions(qs);
    } catch (err) {
      console.error("Preview load error:", err);
      setPreviewQuestions([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Filter tests by status & search query
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      if (statusFilter === "saved" && t.status !== "saved") return false;
      if (statusFilter === "draft" && t.status !== "draft") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (t.exam_title || "").toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        (t.class_grade || "").toLowerCase().includes(q) ||
        (t.board || "").toLowerCase().includes(q)
      );
    });
  }, [tests, statusFilter, searchQuery]);

  const savedCount = useMemo(() => tests.filter((t) => t.status === "saved").length, [tests]);
  const draftCount = useMemo(() => tests.filter((t) => t.status === "draft").length, [tests]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Test History
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {tests.length} Total
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Access, preview, and download your generated question papers and answer keys anytime.
            </p>
          </div>
          <GlossyButton label="Create Test" icon={Icons.Zap} small onClick={onCreateNew} isStartupsStyle />
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 p-2 rounded-[22px] bg-slate-50/80 dark:bg-slate-900/50 border border-black/5 dark:border-white/5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Icons.Search />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by test title, subject, or class..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <Icons.X />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-sm overflow-x-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${statusFilter === "all"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              All Tests ({tests.length})
            </button>
            <button
              onClick={() => setStatusFilter("saved")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap ${statusFilter === "saved"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "saved" ? "bg-white" : "bg-emerald-500"}`} />
              PDF Ready ({savedCount})
            </button>
            <button
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${statusFilter === "draft"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-amber-600 dark:hover:text-amber-400"
                }`}
            >
              Drafts ({draftCount})
            </button>
          </div>
        </div>

        {/* Tests List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-black/5 dark:bg-white/5 rounded-[24px]" />
            ))}
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 inset-pill border-none text-slate-400 rounded-[24px] flex items-center justify-center mx-auto mb-4">
              <Icons.FileText />
            </div>
            <p className="text-slate-500 font-bold text-lg">
              {tests.length === 0 ? "No tests yet" : "No matching tests found"}
            </p>
            <p className="text-slate-400 text-sm font-medium mt-1">
              {tests.length === 0
                ? "Generate or build your first test paper to download PDFs and answer keys."
                : "Try clearing your search query or switching filters."}
            </p>
            {tests.length === 0 ? (
              <div className="mt-6 flex justify-center">
                <GlossyButton label="Create First Test" icon={Icons.Zap} small onClick={onCreateNew} isStartupsStyle />
              </div>
            ) : (
              <button
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                className="mt-4 px-4 py-2 text-xs font-bold text-indigo-600 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredTests.map((t) => (
              <div
                key={t.id}
                className="flex flex-col xl:flex-row xl:items-center justify-between p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] bg-white/50 dark:bg-slate-800/40 border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-slate-800/70 transition-all group gap-4 shadow-sm hover:shadow-md"
              >
                {/* Left: Test Info */}
                <div className="flex items-start sm:items-center gap-3 sm:gap-5 min-w-0">
                  <div
                    className="p-3 sm:p-4 rounded-[18px] sm:rounded-[24px] inset-pill border-none text-slate-800 dark:text-white shadow-inner shrink-0"
                    style={{ color: "var(--theme-start)" }}
                  >
                    <Icons.FileText />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg transition-colors truncate">
                        {t.exam_title || "Untitled Test Paper"}
                      </h4>
                      {t.status === "saved" ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          PDF Saved & Ready
                        </span>
                      ) : (
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider border ${statusColor(t.status)}`}>
                          {t.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                      Class {t.class_grade} · {t.subject} · {t.board} · {formatDate(t.created_at)}
                    </p>
                  </div>
                </div>

                {/* Right: Badges & Action Buttons */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap xl:flex-nowrap shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-700/50 justify-between sm:justify-start">
                  {t.total_questions > 0 && (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 inset-pill border-none px-3 py-1.5 rounded-[16px]">
                      {t.total_questions}Q · {t.total_marks}M
                    </span>
                  )}

                  {/* Preview Button */}
                  <button
                    onClick={() => handleOpenPreview(t)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
                    title="Preview Test Questions"
                  >
                    <span className="text-sm">👁️</span>
                    <span>Preview</span>
                  </button>

                  {/* Paper PDF Button */}
                  <button
                    onClick={() => handleDownload(t, "pdf", false)}
                    disabled={downloadingId === t.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:border-indigo-300 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Download Question Paper PDF"
                  >
                    {downloadingId === t.id && downloadingType === "paper" ? (
                      <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-sm">📄</span>
                    )}
                    <span>Paper PDF</span>
                  </button>

                  {/* Answer Key Button */}
                  <button
                    onClick={() => handleDownload(t, "pdf", true)}
                    disabled={downloadingId === t.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-300 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Download Official Answer Key & Solutions PDF"
                  >
                    {downloadingId === t.id && downloadingType === "key" ? (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-sm">🔑</span>
                    )}
                    <span>Answer Key</span>
                  </button>

                  {/* Word (DOCX) Button */}
                  <button
                    onClick={() => handleDownload(t, "docx", false)}
                    disabled={downloadingId === t.id}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Download in Word (DOCX) format"
                  >
                    {downloadingId === t.id && downloadingType === "docx" ? (
                      <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-xs">📝</span>
                    )}
                    <span>DOCX</span>
                  </button>

                  {/* Check students' copies of this test (rubric comes from the saved answers) */}
                  <button
                    onClick={() => navigateTo(`/dashboard/test-generator?tab=check&test=${t.id}`)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 transition-all shadow-xs cursor-pointer"
                    title="Photograph students' answer copies and check them with AI"
                  >
                    <span className="text-sm">✅</span>
                    <span>Check copies</span>
                  </button>

                  {t.status === "saved" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label="More actions" data-testid="test-more"
                          className="flex items-center justify-center min-w-[40px] px-3 py-2 rounded-xl text-sm font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer">⋯</button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setLinkTest(t)}>
                          📸 {links[t.id]?.length ? "Checking Link ✓" : "Checking Link"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {linkTest && (
        <Suspense fallback={null}><CheckingLinkModal open={!!linkTest} onOpenChange={o => { if (!o) setLinkTest(null); }}
          test={{ id: linkTest.id, title: linkTest.exam_title || "Test Paper", subject: linkTest.subject, class_grade: linkTest.class_grade,
                  board: linkTest.board, total_marks: linkTest.total_marks }}
          links={links[linkTest.id] || []}
          onLinked={l => setLinks(m => ({ ...m, [linkTest.id]: [l, ...(m[linkTest.id] || []).filter(x => x.assignmentId !== l.assignmentId)] }))} /></Suspense>
      )}

      {/* ================= PREVIEW MODAL ================= */}
      {previewTest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
            <div
              className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                      {previewTest.exam_title || "Test Paper Preview"}
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      Class {previewTest.class_grade}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {previewTest.subject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Board: {previewTest.board} · Date: {formatDate(previewTest.created_at)} · Max Marks: {previewTest.total_marks}M
                  </p>
                </div>

                {/* Modal Header Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleDownload(previewTest, "pdf", false)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                  >
                    <span>📄</span>
                    <span>Paper PDF</span>
                  </button>
                  <button
                    onClick={() => handleDownload(previewTest, "pdf", true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                  >
                    <span>🔑</span>
                    <span>Answer Key</span>
                  </button>
                  <button
                    onClick={() => setPreviewTest(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
                  >
                    <Icons.X />
                  </button>
                </div>
              </div>

              {/* View Tabs */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
                <button
                  onClick={() => setPreviewTab("paper")}
                  className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${previewTab === "paper"
                      ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                  📄 Question Paper ({previewQuestions.length}Q)
                </button>
                <button
                  onClick={() => setPreviewTab("key")}
                  className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${previewTab === "key"
                      ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                  🔑 Answer Key & Step-by-Step Solutions
                </button>
              </div>

              {/* Scrollable Questions Content */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {previewLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                    ))}
                  </div>
                ) : previewQuestions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-500 font-bold">No individual question rows found for this record.</p>
                    <p className="text-slate-400 text-xs mt-1">You can still generate and download the complete PDF using the buttons above.</p>
                  </div>
                ) : (
                  previewQuestions.map((q, idx) => {
                    const qMarks = q.marks || 1;
                    const options = Array.isArray(q.options)
                      ? q.options
                      : typeof q.options === "string"
                        ? JSON.parse(q.options || "[]")
                        : [];

                    return (
                      <div
                        key={idx}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3"
                      >
                        {/* Question Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center">
                              Q{idx + 1}
                            </span>
                            {q.format && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {q.format}
                              </span>
                            )}
                            {q.difficulty && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400">
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                            [{qMarks} Mark{qMarks > 1 ? "s" : ""}]
                          </span>
                        </div>

                        {/* Question Text */}
                        <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                          {q.text || q.question_text || q.questionText}
                        </p>

                        {/* Options if MCQ */}
                        {options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {options.map((opt: string, optIdx: number) => {
                              const letters = ["A", "B", "C", "D", "E"];
                              const letter = letters[optIdx] || String(optIdx + 1);
                              const isCorrect = previewTab === "key" && (
                                q.correct_answer === opt ||
                                q.correct_answer === letter ||
                                q.correctAnswer === opt
                              );

                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 ${isCorrect
                                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold"
                                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                    }`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isCorrect
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    }`}>
                                    {letter}
                                  </span>
                                  <span>{opt}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Answer Key Details */}
                        {previewTab === "key" && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm">
                              <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                                Correct Answer:{" "}
                              </span>
                              <span className="font-medium text-emerald-900 dark:text-emerald-200">
                                {q.correct_answer || q.correctAnswer || "Refer to explanation"}
                              </span>
                            </div>
                            {(q.explanation || q.solution) && (
                              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 text-xs sm:text-sm text-blue-900 dark:text-blue-200">
                                <span className="font-extrabold block mb-0.5 text-blue-800 dark:text-blue-300">
                                  Step-by-Step Explanation:
                                </span>
                                <span className="font-normal leading-relaxed">
                                  {q.explanation || q.solution}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

/* ------------------- MODULES TAB COMPONENT ------------------- */
const ModulesPageComponent = lazy(() => import("../pages/ModulesPage"));
// A render error inside Modules (e.g. unexpected AI output) must not blank the whole dashboard.
class TabErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[a4ai] dashboard tab crashed:", err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-bold text-slate-900">This section could not be shown.</p>
        <p className="mt-1 text-sm text-slate-500">Reload the page to try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          Reload
        </button>
      </div>
    );
  }
}

function ModulesTab() {
  return (
    <TabErrorBoundary>
      <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>}>
        <ModulesPageComponent />
      </Suspense>
    </TabErrorBoundary>
  );
}
function AssignmentsWithWorksheet({ initialSubTab = 'assignments' }: { initialSubTab?: 'assignments' | 'worksheet' }) {
  const [subTab, setSubTab] = React.useState<'assignments' | 'worksheet'>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-2xl p-1.5 border border-slate-200/80 dark:border-slate-700 w-fit shadow-xs mb-2">
        <button
          onClick={() => setSubTab('assignments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            subTab === 'assignments'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📋 Assignments</span>
        </button>
        <button
          onClick={() => setSubTab('worksheet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            subTab === 'worksheet'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📝 Worksheet Generator</span>
        </button>
      </div>
      <Suspense fallback={<TabFallback />}>
        {subTab === 'assignments' && <TeacherAssignmentsTab />}
        {subTab === 'worksheet' && <WorksheetGenerator />}
      </Suspense>
    </div>
  );
}

/* ------------------- MAIN PAGE ------------------- */
export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";

  const { isProctor } = useProctorCheck();
  const [activeTab, setActiveTab] = useState("dashboard");
  // deep link: /dashboard?tab=assignments&assignment=<id>&view=copies (Checking Link → "Submissions dekho")
  const location = useLocation();
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab === "assignments" || tab === "modules") setActiveTab(tab);
  }, [location.search]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [activeTheme, setActiveTheme] = useState<keyof typeof COLOR_SCHEMES>("orange");
  const currentThemeConfig = COLOR_SCHEMES[activeTheme];

  const [allTests, setAllTests] = useState<SavedTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [assignmentsSubTab, setAssignmentsSubTab] = useState<'assignments' | 'worksheet'>('assignments');
  const [downloadingRecentId, setDownloadingRecentId] = useState<string | null>(null);


  // Keyed on the id (the user object changes on every session refresh). Newest 50 only.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setTestsLoading(true);
    supabase
      .from("tests")
      .select("id, exam_title, board, class_grade, subject, status, total_questions, total_marks, created_at")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[a4ai] test history:", error.message);
          toast.error("Couldn't load your tests. Check your connection and refresh.");
        } else if (data) setAllTests(data as SavedTest[]);
        setTestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const recentTests = allTests.slice(0, 3);

  const currentMonthTestsCount = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return allTests.filter((t) => {
      if (!t.created_at) return true;
      const d = new Date(t.created_at);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
  }, [allTests]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setShowAppearance(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getFirstName = () => displayName?.split(" ")[0] || "Educator";

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSent(true);
    setTimeout(() => { setInviteSent(false); setShowInviteModal(false); setInviteEmail(""); }, 2000);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const navItems = [
    { id: "dashboard", Icon: Icons.Grid, label: "Dashboard", color: "text-blue-500" },
    { id: "calendar", Icon: Icons.Calendar, label: "Calendar", color: "text-indigo-500" },
    { id: "assignments", Icon: Icons.FileText, label: "Assignments", color: "text-sky-500" },
    { id: "attendance", Icon: Icons.Clock, label: "Attendance", color: "text-violet-500" },
    { id: "students", Icon: Icons.Users, label: "Students", color: "text-orange-500" },
    ...(isProctor ? [{ id: "section", Icon: Icons.Grid, label: "My Section", color: "text-teal-500" }] : []),
    { id: "modules", Icon: Icons.FolderOpen, label: "Modules", color: "text-purple-500" },
    { id: "tests", Icon: Icons.History, label: "Test History", color: "text-rose-500" },
    { id: "analytics", Icon: Icons.Chart, label: "Analytics", color: "text-emerald-500" },
    { id: "ai-tools", Icon: Icons.Sparkles, label: "AI Tools", color: "text-amber-500" },
  ];

  const finalNavItems = navItems;

  return (
    <div
      className={`dashboard-root ${isDarkMode ? "dark" : ""}`}
      style={{
        '--theme-start': currentThemeConfig.start,
        '--theme-end': currentThemeConfig.end,
        '--theme-shadow': currentThemeConfig.shadow,
      } as React.CSSProperties}
    >
      <div className="flex h-[100dvh] w-full text-slate-800 dark:text-slate-100 overflow-hidden relative bg-[#F8F9FA] dark:bg-[#0A0A0A] transition-colors duration-500">
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />

        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div
            className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-[0.03] dark:opacity-[0.05]"
            style={{ background: 'var(--theme-start)' }}
          />
          <div
            className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-[0.03] dark:opacity-[0.05] animation-delay-2000"
            style={{ background: 'var(--theme-end)' }}
          />
          <div
            className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-[0.03] dark:opacity-[0.05] animation-delay-4000"
            style={{ background: 'var(--theme-start)' }}
          />
        </div>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-white/20 dark:bg-black/60 backdrop-blur-md z-[190] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ===== SIDEBAR ===== */}
        <aside
          className={`fixed lg:relative top-0 left-0 w-[288px] h-full flex flex-col bg-white/95 dark:bg-black/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-white/5 z-[200] lg:z-50 shrink-0 transform transition-transform duration-300 overflow-y-auto ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
        >
          <div className="p-5 pb-2">
            <div className="flex items-center justify-between mb-8 px-2 border-b border-slate-100 dark:border-white/5 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] sm:rounded-[24px] inset-pill border-none flex items-center justify-center shrink-0 overflow-hidden bg-white dark:bg-slate-800">
                  <img
                    src="/ICON.ico"
                    alt="a4ai logo"
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                    onError={(e: any) => {
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<span style="font-size:22px;font-weight:900;color:#111">a4</span>';
                      }
                    }}
                  />
                </div>
                <span className="font-black text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white leading-none">
                  a4ai
                </span>
              </div>
              <button
                className="lg:hidden text-slate-500 bg-slate-100 p-1.5 rounded-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icons.X />
              </button>
            </div>

            <div>
              <nav className="space-y-1.5 mt-2">
                {finalNavItems.map((item) => {
                  const ItemIcon = item.Icon;
                  return (
                    <SidebarButton
                      key={item.id}
                      active={activeTab === item.id}
                      Icon={ItemIcon}
                      label={item.label}
                      colorClass={item.color}
                      badge={(item as any).badge}
                      onClick={() => {
                        if (item.id === "dashboard") {
                          navigate("/dashboard");
                        }
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                    />
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="mt-auto px-5 pb-4">
            <SubscriptionSidebarWidget navigate={navigate} testsCount={currentMonthTestsCount} />
            <SidebarHelpWidget />
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1 h-full overflow-y-auto relative z-10 scroll-smooth pb-24 sm:pb-32">
          <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto relative">

            {/* HEADER */}
            <header
              className="sticky lg:relative top-0 z-[150] lg:z-[100] bg-white/95 dark:bg-black/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-b lg:border-none border-slate-200/50 dark:border-white/5 px-4 sm:px-6 lg:px-0 py-3 lg:py-0 -mx-4 sm:-mx-6 lg:mx-0 mb-6 lg:mb-12 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 lg:gap-6 transition-colors duration-500"
              style={{ animationDelay: "100ms" }}
            >
              <div className="flex lg:hidden items-center gap-3">
                <button
                  className="p-2 sm:p-2.5 text-slate-800 dark:text-white glass-panel rounded-[16px] sm:rounded-[20px] shrink-0"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Icons.Menu />
                </button>
                <button
                  onClick={() => { navigate("/dashboard"); setActiveTab("dashboard"); }}
                  className="flex items-center gap-3 ml-1"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[12px] sm:rounded-[16px] inset-pill border-none flex items-center justify-center shrink-0 overflow-hidden bg-white dark:bg-slate-800">
                    <img
                      src="/ICON.ico"
                      alt="a4ai logo"
                      className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                      onError={(e: any) => {
                        e.currentTarget.style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = '<span style="font-size:14px;font-weight:900;color:#111">a4</span>';
                        }
                      }}
                    />
                  </div>
                  <span className="font-black text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white leading-none">
                    a4ai
                  </span>
                </button>
              </div>

              <div className="hidden lg:flex flex-col min-w-0 w-full lg:w-auto">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  Welcome, {getFirstName()}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-1 sm:mt-2 font-medium truncate">
                  Here's what's happening in your classes.
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
                <div className="flex-1 lg:flex-none min-w-0">
                  <SearchBar tests={allTests} onNavChange={(tab) => { setActiveTab(tab); }} />
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="relative shrink-0" ref={notifRef}>
                    <button
                      onClick={() => setIsNotifOpen(!isNotifOpen)}
                      className={`p-2.5 sm:p-3 rounded-[20px] sm:rounded-[24px] inset-pill transition-all relative ${isNotifOpen ? "text-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                      <Icons.Bell />
                      <span className="absolute top-2 sm:top-2.5 right-2 sm:right-2.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black" style={{ background: "var(--theme-start)" }} />
                    </button>
                    {isNotifOpen && (
                      <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 glass-overlay rounded-[32px] sm:rounded-[40px] p-4 sm:p-5 flex flex-col gap-2 z-[150]">
                        <div className="flex justify-between items-center mb-3 px-2">
                          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                            Notifications
                          </h3>
                          <span className="text-[10px] font-bold btn-glossy-theme px-2.5 py-1 rounded-full">
                            New
                          </span>
                        </div>
                        <div className="flex gap-3 items-start p-3 sm:p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors cursor-pointer inset-pill border-none">
                          <div className="shrink-0 mt-0.5" style={{ color: "var(--theme-start)" }}><Icons.Check /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              Welcome to a4ai!
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              Start generating test papers.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3 items-start p-3 sm:p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors cursor-pointer inset-pill border-none">
                          <div className="shrink-0 mt-0.5" style={{ color: "var(--theme-start)" }}><Icons.Youtube /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              Community Quiz is here!
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              Create quizzes from any YouTube video instantly.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative shrink-0" ref={profileRef}>
                    <button
                      onClick={() => {
                        setIsProfileOpen(!isProfileOpen);
                        if (isProfileOpen) setShowAppearance(false);
                      }}
                      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[24px] glass-panel transition-all duration-200 hover:shadow-md group ${isProfileOpen ? "ring-2 ring-slate-400/50" : ""
                        }`}
                    >
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-[18px] sm:rounded-[20px] flex items-center justify-center text-white shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}
                      >
                        <Icons.GradCap />
                      </div>
                      <div className="hidden sm:block text-left">
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight transition-colors truncate max-w-[110px]">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium">Educator</p>
                      </div>
                      <div className="text-slate-400 hidden sm:block transition-transform duration-200" style={{ transform: isProfileOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                        <Icons.ChevronDown />
                      </div>
                    </button>

                    {isProfileOpen && (
                      <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 glass-overlay rounded-[32px] sm:rounded-[40px] p-3 flex flex-col gap-1 z-[150]">
                        <div className="px-4 sm:px-5 py-4 sm:py-5 mb-1 inset-pill rounded-[28px] sm:rounded-[32px] border-none flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-[20px] flex items-center justify-center text-white shrink-0 shadow-md"
                            style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}
                          >
                            <Icons.GradCap />
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-800 dark:text-white text-base truncate">
                              {displayName}
                            </p>
                            <p className="text-xs text-slate-500 font-medium truncate">{user?.email}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => { navigate("/settings"); setIsProfileOpen(false); }}
                          className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <Icons.User /> My Profile
                          </div>
                          <div className="text-slate-400 transition-transform">
                            <Icons.ChevronRight />
                          </div>
                        </button>

                        <button
                          className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <Icons.Globe /> Language
                          </div>
                          <div className="text-slate-400 transition-transform">
                            <Icons.ChevronRight />
                          </div>
                        </button>

                        <div className="flex flex-col rounded-[24px] sm:rounded-[28px] overflow-hidden">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowAppearance(!showAppearance); }}
                            className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors group w-full"
                          >
                            <div className="flex items-center gap-3">
                              <Icons.Sun /> Appearance
                            </div>
                            <div className="text-slate-400 transition-transform duration-200" style={{ transform: showAppearance ? "rotate(180deg)" : "rotate(0deg)" }}>
                              <Icons.ChevronDown />
                            </div>
                          </button>

                          {showAppearance && (
                            <div className="px-4 sm:px-5 pb-4 pt-1 flex flex-col gap-4 bg-black/5 dark:bg-white/5">
                              <div className="flex items-center justify-between pt-2">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Dark Mode</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }}
                                  className={`w-11 h-6 rounded-full shadow-inner relative flex items-center px-1 transition-colors duration-300 ${isDarkMode ? "bg-slate-700" : "bg-slate-300"
                                    }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${isDarkMode ? "translate-x-5" : "translate-x-0"
                                      }`}
                                  />
                                </button>
                              </div>

                              <div>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Color Scheme</span>
                                <div className="flex flex-wrap gap-3 place-items-center">
                                  {(Object.keys(COLOR_SCHEMES) as Array<keyof typeof COLOR_SCHEMES>).map((key) => (
                                    <button
                                      key={key}
                                      onClick={(e) => { e.stopPropagation(); setActiveTheme(key); }}
                                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center transition-transform shadow-sm border-2 ${activeTheme === key ? "border-slate-800 dark:border-white scale-110" : "border-transparent"
                                        }`}
                                      style={{ background: COLOR_SCHEMES[key].start }}
                                      title={key}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 my-1 mx-4" />

                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-[24px] sm:rounded-[28px] transition-colors"
                        >
                          <Icons.LogOut /> Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* MOBILE GREETING */}
            <div className="lg:hidden mb-6 sm:mb-8 px-1" style={{ animationDelay: "150ms" }}>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                Welcome, {getFirstName()}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-medium mt-1 truncate">
                Here's what's happening in your classes.
              </p>
            </div>

            <Suspense fallback={<TabFallback />}>
            {/* ===== DASHBOARD TAB ===== */}
            {activeTab === "dashboard" && (
              <div className="space-y-6 sm:space-y-8">
                <div>
                  <InstituteTeacherPanel userId={user?.id} userEmail={user?.email} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 sm:gap-8">
                  <div className="glass-panel rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 lg:p-12 relative overflow-hidden flex flex-col justify-center group">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/30 to-transparent pointer-events-none rounded-[48px]" />
                    <div className="relative z-10 max-w-xl">
                      <div className="flex items-center gap-2 mb-4 sm:mb-6 bg-white/60 dark:bg-black/50 border border-white/40 dark:border-white/10 w-fit px-3 sm:px-5 py-1.5 sm:py-2 rounded-[20px] sm:rounded-[24px] shadow-sm">
                        <div style={{ color: "var(--theme-start)" }}><Icons.Brain /></div>
                        <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                          Test Generator
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight leading-[1.1]">
                        Create Test Papers in Minutes.
                      </h2>
                      <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base lg:text-lg mb-6 sm:mb-10 font-medium">
                        Pick chapters, set marks — get a section-wise paper with answer key, ready to print.
                      </p>
                      <GlossyButton
                        label="Create Test"
                        icon={Icons.Zap}
                        onClick={() => navigate("/dashboard/test-generator")}
                        isStartupsStyle={true}
                      />
                    </div>
                  </div>

                  <div className="glass-panel rounded-[32px] sm:rounded-[40px] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                    <div className="flex items-center gap-3 sm:gap-5 mb-6 sm:mb-8">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 inset-pill border-none flex items-center justify-center shadow-inner rounded-[24px] sm:rounded-[28px] shrink-0" style={{ color: "var(--theme-start)" }}>
                        <Icons.Sparkles />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        What's New
                      </h3>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      <GlossyButton
                        label="AI Paper Checker"
                        subLabel="Magical Answer Sheet Grader"
                        icon={Icons.Sparkles}
                        fullWidth
                        showNewBadge
                        isStartupsStyle
                        onClick={() => navigate("/dashboard/test-generator?tab=check")}
                      />
                      <GlossyButton
                        label="Community Quiz"
                        subLabel="From any YouTube video"
                        icon={Icons.Youtube}
                        fullWidth
                        showNewBadge
                        onClick={() => navigate("/teacher/community-quiz/new")}
                      />
                      <GlossyButton
                        label="Host Contest"
                        subLabel="Start Live Competition"
                        icon={Icons.Trophy}
                        fullWidth
                        onClick={() => navigate("/contests")}
                      />
                      <button
                        onClick={() => navigate("/join-institute")}
                        className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-[28px] font-bold text-white transition-all duration-300 btn-join-black group"
                      >
                        <div className="flex items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md h-8 w-8 border border-white/40 shadow-inner shrink-0">
                          <Icons.Users />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                          <span className="font-bold leading-none tracking-tight truncate text-white">Join Institute</span>
                          <span className="text-xs font-medium text-white/60 truncate">Enter code to join</span>
                        </div>
                        <div className="ml-auto pl-2 text-white/30 transition-transform shrink-0">
                          <Icons.ChevronRight />
                        </div>
                      </button>
                      <GlossyButton
                        label="Test History"
                        subLabel="View past papers"
                        icon={Icons.History}
                        fullWidth
                        onClick={() => setActiveTab("tests")}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-8"
                >
                  {[
                    { t: "Active Students", v: "156", c: "+12%", Icon: Icons.Users },
                    { t: "Tests Created", v: String(allTests.length || "0"), c: "All time", Icon: Icons.FileText },
                    { t: "Engagement", v: "92%", c: "+3.2%", Icon: Icons.Chart },
                    { t: "Time Saved", v: "8h", c: "This week", Icon: Icons.Clock },
                  ].map((stat, i) => {
                    const StatIcon = stat.Icon;
                    return (
                      <div
                        key={i}
                        className="glass-panel rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col items-center text-center sm:hover:-translate-y-2 transition-all duration-300"
                      >
                        <div className="mb-3 sm:mb-5 inset-pill p-2.5 sm:p-4 rounded-[16px] sm:rounded-[24px] border-none shrink-0" style={{ color: "var(--theme-start)" }}>
                          <StatIcon />
                        </div>
                        <h3 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-1 sm:mb-2 tracking-tight stat-number">
                          {stat.v}
                        </h3>
                        <p className="text-[9px] sm:text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 sm:mb-4">
                          {stat.t}
                        </p>
                        <span className="text-[10px] sm:text-xs text-slate-800 dark:text-slate-200 font-extrabold bg-slate-200/50 dark:bg-white/10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-[16px] sm:rounded-[20px] border border-slate-300/50 dark:border-white/10">
                          {stat.c}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* ===== AI TOOLS QUICK SECTION ===== */}
                <div
                  className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs">
                          ✨ AI SUPERPOWERS
                        </span>
                      </div>
                      <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-3xl tracking-tight">
                        AI Teaching Tools
                      </h3>
                      <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                        Automate grading, test creation, and interactive learning in seconds.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("ai-tools")}
                      className="inset-pill text-slate-800 dark:text-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 rounded-[20px] sm:rounded-[24px] font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border-none self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
                    >
                      Explore All Tools <Icons.ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {[
                      {
                        Icon: Icons.Sparkles,
                        title: "AI Paper Checker",
                        desc: "Magically check & auto-grade handwritten answer sheets, test papers & assignments with instant scoring and line-by-line feedback.",
                        action: () => navigate("/dashboard/test-generator?tab=check"),
                        badge: "MAGICAL AI",
                        badgeClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
                        btnLabel: "Check Papers",
                        highlight: true,
                      },
                      {
                        Icon: Icons.Brain,
                        title: "Test Generator",
                        desc: "Create complete CBSE & state board test papers from 1 Lakh+ NCERT questions in 30 seconds with ready answer keys.",
                        action: () => navigate("/dashboard/test-generator"),
                        badge: "PRO",
                        badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
                        btnLabel: "Create Test",
                      },
                      {
                        Icon: Icons.Youtube,
                        title: "Video to Quiz",
                        desc: "Turn any educational YouTube video into an interactive live community quiz instantly.",
                        action: () => navigate("/teacher/community-quiz/new"),
                        badge: "NEW",
                        badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                        btnLabel: "Create Quiz",
                      },
                      {
                        Icon: Icons.Grid,
                        title: "Worksheet Studio",
                        desc: "Design structured practice worksheets and homework drill sheets tailored to your curriculum.",
                        action: () => {
                          setAssignmentsSubTab("worksheet");
                          setActiveTab("assignments");
                        },
                        badge: "PRACTICE",
                        badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                        btnLabel: "Open Studio",
                      },
                      {
                        Icon: Icons.Book,
                        title: "Smart Flashcards",
                        desc: "Convert textbook chapters and class notes into high-retention active recall study flashcards.",
                        action: () => navigate("/dashboard/flashcards"),
                        badge: "STUDY",
                        badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                        btnLabel: "Explore Cards",
                      },
                      {
                        Icon: Icons.Search,
                        title: "PYQ Question Bank",
                        desc: "Search, filter & assign verified Previous Year Questions with step-by-step marking rubrics.",
                        action: () => navigate("/practice/zone"),
                        badge: "10 YRS",
                        badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
                        btnLabel: "Browse PYQs",
                      },
                    ].map((tool, idx) => {
                      const ToolIcon = tool.Icon;
                      return (
                        <div
                          key={idx}
                          onClick={tool.action}
                          className={`glass-panel p-5 sm:p-7 rounded-[24px] sm:rounded-[36px] flex flex-col justify-between transition-all duration-300 cursor-pointer group hover:shadow-xl border ${
                            tool.highlight
                              ? "border-amber-400/50 bg-amber-500/5 dark:bg-amber-500/10"
                              : "hover:border-blue-500/30"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                              <div
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-[16px] sm:rounded-[20px] inset-pill border-none flex items-center justify-center shrink-0 transition-transform"
                                style={{ color: "var(--theme-start)" }}
                              >
                                <ToolIcon />
                              </div>
                              {tool.badge && (
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs ${tool.badgeClass}`}>
                                  {tool.badge}
                                </span>
                              )}
                            </div>
                            <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                              {tool.title}
                            </h4>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed line-clamp-2">
                              {tool.desc}
                            </p>
                          </div>
                          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                              {tool.btnLabel}
                            </span>
                            <div className="text-slate-400 group-hover:text-blue-600 transition-all">
                              <Icons.ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12"
                >
                  <div className="flex justify-between items-center mb-5 sm:mb-8">
                    <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-3xl tracking-tight">
                      Recent Tests
                    </h3>
                    <button
                      onClick={() => setActiveTab("tests")}
                      className="inset-pill text-slate-800 dark:text-slate-200 px-4 sm:px-6 py-2 sm:py-3 rounded-[20px] sm:rounded-[24px] font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border-none"
                    >
                      View All
                    </button>
                  </div>

                  {testsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 bg-black/5 dark:bg-white/5 rounded-[20px]" />
                      ))}
                    </div>
                  ) : recentTests.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500 font-medium">No tests yet — create your first one!</p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {recentTests.map((test) => (
                        <div
                          key={test.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-black/5 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/60 transition-all duration-300 group gap-3"
                        >
                          <div
                            onClick={() => setActiveTab("tests")}
                            className="flex items-center gap-3 sm:gap-5 min-w-0 cursor-pointer flex-1"
                          >
                            <div className="p-3 sm:p-4 rounded-[16px] sm:rounded-[24px] inset-pill border-none shadow-inner shrink-0" style={{ color: "var(--theme-start)" }}>
                              <Icons.FileText />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-xl transition-colors truncate">
                                {test.exam_title || "Untitled Test"}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">
                                Class {test.class_grade} · {test.subject} · {formatDate(test.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap shrink-0">
                            {test.total_questions > 0 && (
                              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 inset-pill border-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-[16px] sm:rounded-[20px]">
                                {test.total_questions}Q · {test.total_marks}M
                              </span>
                            )}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setDownloadingRecentId(test.id + "_paper");
                                try {
                                  await downloadTestDocument({ test, format: "pdf", isAnswerKey: false, teacherId: user?.id });
                                } finally {
                                  setDownloadingRecentId(null);
                                }
                              }}
                              disabled={downloadingRecentId === test.id + "_paper"}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 hover:bg-indigo-100 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                              title="Download Question Paper PDF"
                            >
                              {downloadingRecentId === test.id + "_paper" ? (
                                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "📄 PDF"
                              )}
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setDownloadingRecentId(test.id + "_key");
                                try {
                                  await downloadTestDocument({ test, format: "pdf", isAnswerKey: true, teacherId: user?.id });
                                } finally {
                                  setDownloadingRecentId(null);
                                }
                              }}
                              disabled={downloadingRecentId === test.id + "_key"}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 hover:bg-emerald-100 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                              title="Download Answer Key PDF"
                            >
                              {downloadingRecentId === test.id + "_key" ? (
                                <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "🔑 Key"
                              )}
                            </button>
                            <span
                              className={`text-[10px] px-3 py-1.5 rounded-[16px] font-extrabold uppercase border ${test.status === "saved"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400"
                                }`}
                            >
                              {test.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== STUDENTS TAB ===== */}
            {activeTab === "students" && (
              <div className="space-y-6 sm:space-y-8">
                <InstituteTeacherPanel userId={user?.id} userEmail={user?.email} />
                <TeacherStudentsTab
                  userId={user?.id}
                  userEmail={user?.email}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              </div>
            )}

            {activeTab === "section" && (
              <div className="space-y-6 sm:space-y-8">
                <ProctorSectionView />
              </div>
            )}

            {activeTab === "calendar" && <TeacherCalendarTab />}
            {activeTab === "modules" && <ModulesTab />}
            {activeTab === "assignments" && <AssignmentsWithWorksheet initialSubTab={assignmentsSubTab} />}

            {/* ===== ATTENDANCE TAB ===== */}
            {activeTab === "attendance" && (
              <div className="space-y-6 sm:space-y-8">
                <AttendancePage />
              </div>
            )}

            {/* ===== TEST HISTORY TAB ===== */}
            {activeTab === "tests" && (
              <TestHistory
                onCreateNew={() => navigate("/dashboard/test-generator")}
                tests={allTests}
                loading={testsLoading}
                user={user}
              />
            )}

            {/* ===== ANALYTICS TAB ===== */}
            {activeTab === "analytics" && (
              <TeacherAnalyticsTab
                user={user}
                allTests={allTests}
                onNavigateTab={(tab) => {
                  if (tab === "dashboard") navigate("/dashboard");
                  setActiveTab(tab);
                }}
              />
            )}

            </Suspense>

            {/* ===== AI TOOLS TAB ===== */}
            {activeTab === "ai-tools" && (
              <div className="space-y-6 sm:space-y-8">
                <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-6 sm:p-10 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs mb-3">
                        <Icons.Sparkles className="w-3.5 h-3.5" />
                        AI TEACHING SUPERPOWERS
                      </div>
                      <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                        Magical AI Teaching Tools
                      </h2>
                      <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 font-medium mt-2 max-w-2xl">
                        Scan & auto-grade answer sheets, generate board exam test papers, convert YouTube lectures into live quizzes, and create worksheets in seconds.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {[
                    {
                      Icon: Icons.Sparkles,
                      title: "AI Paper Checker",
                      tagline: "Instant answer sheet & test grading",
                      desc: "Magically scan and auto-grade handwritten student answer sheets & test papers with question-by-question scoring and rubric feedback.",
                      action: () => navigate("/dashboard/test-generator?tab=check"),
                      badge: "MAGICAL AI",
                      badgeClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
                      btnLabel: "Check Papers",
                      highlights: ["Handwritten copies supported", "Rubric & step-wise scoring", "Instant student analysis"],
                      highlight: true,
                    },
                    {
                      Icon: Icons.Brain,
                      title: "Test Generator",
                      tagline: "CBSE & State Board papers in < 2 mins",
                      desc: "Pick chapters, set marks spread, and generate balanced test papers from 1 Lakh+ NCERT questions with complete answer keys.",
                      action: () => navigate("/dashboard/test-generator"),
                      badge: "1 LAKH+ NCERT",
                      badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
                      btnLabel: "Create Test",
                      highlights: ["Bloom's taxonomy spread", "Bilingual English / Hindi", "1-click PDF / DOCX export"],
                      highlight: false,
                    },
                    {
                      Icon: Icons.Youtube,
                      title: "Video to Live Quiz",
                      tagline: "Turn YouTube lessons into quizzes",
                      desc: "Paste any educational YouTube URL. AI extracts concepts, generates timed MCQs, and launches a real-time live contest.",
                      action: () => navigate("/teacher/community-quiz/new"),
                      badge: "POPULAR",
                      badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                      btnLabel: "Create Quiz",
                      highlights: ["Automatic video transcripts", "Multiplayer live contest", "Instant leaderboards"],
                      highlight: false,
                    },
                    {
                      Icon: Icons.Grid,
                      title: "Worksheet Studio",
                      tagline: "Custom homework & drill sheets",
                      desc: "Design structured practice worksheets with diagrams, step spaces, and formulas tailored to your classroom syllabus.",
                      action: () => {
                        setAssignmentsSubTab("worksheet");
                        setActiveTab("assignments");
                      },
                      badge: "PRACTICE",
                      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                      btnLabel: "Open Studio",
                      highlights: ["Curriculum aligned", "Formatted for A4 print", "Difficulty progression"],
                      highlight: false,
                    },
                    {
                      Icon: Icons.Book,
                      title: "Smart Flashcards",
                      tagline: "High-retention study cards",
                      desc: "Convert lengthy textbook chapters and complex formulas into active-recall digital flashcards for high-retention revision.",
                      action: () => navigate("/dashboard/flashcards"),
                      badge: "ACTIVE RECALL",
                      badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                      btnLabel: "Explore Cards",
                      highlights: ["Spaced repetition", "Chapter summaries", "Mobile-friendly revision"],
                      highlight: false,
                    },
                    {
                      Icon: Icons.Search,
                      title: "PYQ Question Bank",
                      tagline: "Past 10-year board questions",
                      desc: "Search, filter, and assign verified Previous Year Questions with official marking rubrics and step-by-step solutions.",
                      action: () => navigate("/practice/zone"),
                      badge: "EXAM BANK",
                      badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
                      btnLabel: "Browse PYQs",
                      highlights: ["CBSE past 10 years", "Chapter-wise breakdown", "Marking scheme included"],
                      highlight: false,
                    },
                  ].map((tool, i) => {
                    const ToolIcon = tool.Icon;
                    return (
                      <div
                        key={i}
                        onClick={tool.action}
                        className={`glass-panel p-6 sm:p-8 rounded-[28px] sm:rounded-[36px] flex flex-col justify-between transition-all duration-300 relative overflow-hidden group cursor-pointer hover:shadow-2xl ${
                          tool.highlight
                            ? "border-amber-400/60 ring-1 ring-amber-400/20 bg-amber-500/[0.03] dark:bg-amber-500/[0.08]"
                            : "hover:border-blue-500/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-5">
                            <div
                              className="w-12 h-12 rounded-[18px] inset-pill border-none flex items-center justify-center shrink-0 transition-transform"
                              style={{ color: "var(--theme-start)" }}
                            >
                              <ToolIcon className="w-6 h-6" />
                            </div>
                            {tool.badge && (
                              <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xs ${tool.badgeClass}`}>
                                {tool.badge}
                              </span>
                            )}
                          </div>

                          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {tool.title}
                          </h3>
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 mb-3">
                            {tool.tagline}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-6">
                            {tool.desc}
                          </p>

                          <div className="space-y-2 mb-6">
                            {tool.highlights.map((h, hIdx) => (
                              <div key={hIdx} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                <Icons.Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>{h}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              tool.action();
                            }}
                            className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-[20px] text-xs sm:text-sm font-bold transition-all shadow-sm group-hover:shadow-md cursor-pointer ${
                              tool.highlight
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110"
                                : "bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white"
                            }`}
                          >
                            <span>{tool.btnLabel}</span>
                            <Icons.ChevronRight className="w-4 h-4 transition-transform" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ===== AI SARTHI (static quick help — no AI call, no animation) ===== */}
        <StaticSarthi variant="teacher" onTab={setActiveTab} accent={currentThemeConfig.start} />

        {/* ===== INVITE MODAL ===== */}
        {showInviteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setShowInviteModal(false)}
            />
            <div className="glass-overlay p-6 sm:p-10 lg:p-12 rounded-[32px] sm:rounded-[40px] w-full max-w-md relative z-10 text-center">
              <button
                onClick={() => setShowInviteModal(false)}
                className="absolute top-4 sm:top-8 right-4 sm:right-8 p-2 sm:p-3 text-slate-500 inset-pill border-none rounded-full hover:text-slate-800 dark:hover:text-white"
              >
                <Icons.X />
              </button>
              {!inviteSent ? (
                <>
                  <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none rounded-[24px] sm:rounded-[36px] flex items-center justify-center mx-auto mb-5 sm:mb-8" style={{ color: "var(--theme-start)" }}>
                    <div className="scale-100 sm:scale-125"><Icons.Mail /></div>
                  </div>
                  <h3 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-4 text-slate-900 dark:text-white tracking-tight">
                    Invite Student
                  </h3>
                  <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-10 font-medium">
                    Send an email invitation to your student.
                  </p>
                  <form onSubmit={handleInvite} className="space-y-5 sm:space-y-8 text-left">
                    <div className="relative">
                      <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2" style={{ color: "var(--theme-start)" }}>
                        <Icons.Mail />
                      </div>
                      <input
                        required
                        type="email"
                        placeholder="Email Address"
                        className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-4 sm:py-5 rounded-[24px] sm:rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-slate-400/50 font-bold text-slate-800 dark:text-white placeholder-slate-400"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <GlossyButton label="Send Invitation" fullWidth />
                  </form>
                </>
              ) : (
                <div className="py-8 sm:py-10">
                  <div className="w-20 h-20 sm:w-28 sm:h-28 bg-slate-200/50 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-slate-300/50 dark:border-white/10" style={{ color: "var(--theme-start)" }}>
                    <div className="scale-125 sm:scale-150"><Icons.Check /></div>
                  </div>
                  <h4 className="font-black text-2xl sm:text-3xl text-slate-900 dark:text-white mb-3 sm:mb-4 tracking-tight">Sent!</h4>
                  <p className="text-slate-500 font-medium text-sm sm:text-lg">
                    They'll appear once they join.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}