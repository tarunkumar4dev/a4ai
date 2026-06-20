// src/pages/TeacherDashboardPage.tsx

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import InstituteTeacherPanel from "@/components/institute/InstituteTeacherPanel";

/* ------------------- SCROLL REVEAL HOOK ------------------- */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -48px 0px" }
    );
    const els = document.querySelectorAll(".scroll-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ------------------- STYLES ------------------- */
const customStyles = `
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

  /* ── Scroll-reveal ── */
  .scroll-reveal {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .scroll-reveal.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Shimmer for accent text using theme color */
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

  /* ── Glass surfaces ── */
  .glass-panel {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-panel {
    background: rgba(15, 15, 15, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }
  .glass-overlay {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(48px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-overlay {
    background: rgba(10, 10, 10, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.9);
  }
  .inset-pill {
    background: rgba(255, 255, 255, 0.5);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.02),
                inset -4px -4px 10px rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  .dark .inset-pill {
    background: rgba(20, 20, 20, 0.6);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.5),
                inset -4px -4px 10px rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* ── DYNAMIC THEME GLOSSY BUTTON ── */
  .btn-glossy-theme {
    background: linear-gradient(135deg, var(--theme-start) 0%, var(--theme-end) 100%);
    box-shadow: inset 0px 2px 4px rgba(255, 255, 255, 0.25),
                inset 0px -2px 4px rgba(0, 0, 0, 0.4),
                0px 8px 20px var(--theme-shadow);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    position: relative;
    overflow: hidden;
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

  /* ── "STARTUPS" STYLED BUTTON ── */
  .btn-startups {
    background: linear-gradient(135deg, #6b21a8 0%, #db2777 50%, #f43f5e 100%);
    box-shadow: inset 0px 2px 4px rgba(255, 255, 255, 0.25),
                inset 0px -2px 4px rgba(0, 0, 0, 0.4),
                0px 8px 20px rgba(219, 39, 119, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    position: relative;
    overflow: hidden;
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

  /* Folder SVG Colors */
  .folder-paper { fill: #F1F5F9; stroke: #CBD5E1; stroke-width: 2; }
  .dark .folder-paper { fill: #222222; stroke: #444444; }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  Search:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Bell:          () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Grid:          () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="2"/><rect width="7" height="7" x="14" y="3" rx="2"/><rect width="7" height="7" x="14" y="14" rx="2"/><rect width="7" height="7" x="3" y="14" rx="2"/></svg>,
  Users:         () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  FileText:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  History:       () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
  Chart:         () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Brain:         () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>,
  Zap:           () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  ChevronRight:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  ChevronDown:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  Trophy:        () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Clock:         () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  GradCap:       () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  MessageCircle: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  Mail:          () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  Check:         () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:             () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Menu:          () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  Moon:          () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  Sun:           () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  User:          () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  LogOut:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  Send:          () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  Loader:        () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Globe:         () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
  Youtube:       () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>,
  Sparkles:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3L8 5 6 7 4 5 6 3Z"/><path d="M18 13L20 15 18 17 16 15 18 13Z"/><path d="M10 7L13 10 13 10 7 10 10 7Z"/><path d="m13 17 2 3 2-3"/><path d="M18 3v4"/><path d="M20 5h-4"/></svg>,
  Star:          () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Book:          () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
};

/* ------------------- THEME COLORS ------------------- */
const COLOR_SCHEMES = {
  black:      { start: '#333333', end: '#000000', shadow: 'rgba(0,0,0,0.4)' },
  maroon:     { start: '#A52A2A', end: '#800000', shadow: 'rgba(128,0,0,0.4)' },
  magenta:    { start: '#FF00FF', end: '#8B008B', shadow: 'rgba(139,0,139,0.4)' },
  teal:       { start: '#20B2AA', end: '#008080', shadow: 'rgba(0,128,128,0.4)' },
  darkYellow: { start: '#DAA520', end: '#B8860B', shadow: 'rgba(184,134,11,0.4)' },
  darkGreen:  { start: '#228B22', end: '#006400', shadow: 'rgba(0,100,0,0.4)' },
  darkPurple: { start: '#8A2BE2', end: '#4B0082', shadow: 'rgba(75,0,130,0.4)' },
  crimsonRed: { start: '#DC143C', end: '#8B0000', shadow: 'rgba(139,0,0,0.4)' },
};

/* ------------------- REUSABLE COMPONENTS ------------------- */

const SidebarButton = ({ active, Icon, label, colorClass, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 rounded-[12px] font-bold text-sm transition-all duration-300 active:scale-95 ${
      active
        ? "bg-slate-200/50 dark:bg-slate-800 shadow-sm text-slate-800 dark:text-white"
        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60"
    }`}
  >
    <div className="flex items-center gap-3 sm:gap-4">
      <div className={`${active ? "scale-110" : ""} transition-transform shrink-0 ${colorClass}`}>
        <Icon />
      </div>
      <span className="truncate tracking-wide">{label}</span>
    </div>
    <div className="text-slate-300 dark:text-slate-600">
      <Icons.ChevronDown />
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
}: any) => (
  <button
    onClick={onClick}
    className={`relative flex items-center justify-center gap-2 sm:gap-3 rounded-[28px] transform transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98] ${
      isStartupsStyle ? "btn-startups" : "btn-glossy-theme"
    } ${
      fullWidth ? "w-full" : "w-auto"
    } ${
      small
        ? "px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[48px]"
        : "px-5 sm:px-8 py-4 sm:py-5 min-h-[56px] sm:min-h-[64px] text-base sm:text-lg"
    } overflow-hidden group`}
  >
    {Icon && (
      <div
        className={`flex items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md ${small ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8 sm:h-10 sm:w-10"} border border-white/40 shadow-inner group-hover:scale-110 transition-transform shrink-0`}
      >
        <Icon size={small ? 14 : 18} />
      </div>
    )}
    <div className="flex flex-col text-left min-w-0">
      <span className="font-bold leading-none tracking-tight truncate flex items-center gap-2 text-white">
        {label}
        {showNewBadge && (
          <span className="new-badge bg-white/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-white">
            NEW
          </span>
        )}
      </span>
      {subLabel && !small && (
        <span className="mt-1 sm:mt-1.5 text-xs font-medium text-white/80 truncate">{subLabel}</span>
      )}
    </div>
    {!small && (
      <div className="ml-auto pl-2 sm:pl-4 text-white/50 group-hover:translate-x-1 transition-transform shrink-0">
        <Icons.ChevronRight />
      </div>
    )}
  </button>
);

/* ------------------- SEARCH BAR WITH LIVE SUGGESTIONS ------------------- */
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
    { type: "nav",  label: "Dashboard",       sub: "Overview & stats",    Icon: Icons.Grid,     action: () => { navigate("/dashboard"); onNavChange("dashboard"); } },
    { type: "nav",  label: "Students",         sub: "Manage your class",   Icon: Icons.Users,    action: () => onNavChange("students") },
    { type: "nav",  label: "Test History",     sub: "All your tests",      Icon: Icons.History,  action: () => onNavChange("tests") },
    { type: "nav",  label: "Analytics",        sub: "Performance graphs",  Icon: Icons.Chart,    action: () => onNavChange("analytics") },
    { type: "nav",  label: "AI Tools",         sub: "Teaching utilities",  Icon: Icons.Brain,    action: () => onNavChange("ai-tools") },
    { type: "tool", label: "Community Quiz",   sub: "From YouTube video",  Icon: Icons.Youtube,  action: () => navigate("/teacher/community-quiz/new") },
    { type: "tool", label: "Create Test",      sub: "CBSE test generator", Icon: Icons.Zap,      action: () => navigate("/dashboard/test-generator") },
    { type: "tool", label: "Host Contest",     sub: "Live competition",    Icon: Icons.Trophy,   action: () => navigate("/contests") },
    { type: "tool", label: "Pricing / Plans",  sub: "Buy Premium",         Icon: Icons.Star,     action: () => navigate("/pricing") },
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
          className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white px-2 placeholder-slate-400"
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
                  className={`p-2 rounded-[14px] inset-pill border-none shrink-0 ${
                    s.type === "test"
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
function SubscriptionSidebarWidget({ navigate }: { navigate: any }) {
  const { status } = useSubscription();

  const isFree = !status || status.plan_slug === "free";
  const isPro = status?.plan_slug === "pro";
  const used = status?.tests_used || 0;
  const limit = status?.test_limit || 10;
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

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

      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {!isPro && (
        <GlossyButton
          label="Upgrade"
          small
          fullWidth
          onClick={() => navigate("/pricing")}
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
          <line x1="30" y1="25" x2="55" y2="25" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" transform="rotate(-15 45 40)"/>
          <line x1="30" y1="32" x2="50" y2="32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" transform="rotate(-15 45 40)"/>
          
          <rect x="35" y="15" width="45" height="55" rx="2" className="folder-paper" transform="rotate(10 55 40)" />
          <circle cx="58" cy="35" r="8" fill="#E2E8F0" transform="rotate(10 55 40)"/>
          <path d="M58 27 A8 8 0 0 1 66 35 L58 35 Z" fill="#94A3B8" transform="rotate(10 55 40)"/>
          
          <rect x="40" y="10" width="35" height="50" rx="2" className="folder-paper" />
          <line x1="45" y1="20" x2="70" y2="20" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
          <line x1="45" y1="26" x2="65" y2="26" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
          <line x1="45" y1="32" x2="70" y2="32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />

          {/* DYNAMIC FOLDER COLORS */}
          <path d="M15 40 C15 35 18 32 23 32 L40 32 L48 40 L85 40 C90 40 93 43 93 48 L93 85 C93 90 90 93 85 93 L23 93 C18 93 15 90 15 85 Z" fill="var(--theme-end)" />
          <path d="M12 48 C12 43 15 40 20 40 L45 40 L53 48 L88 48 C93 48 96 51 96 56 L90 88 C89 92 85 95 80 95 L20 95 C15 95 11 92 10 88 Z" fill="var(--theme-start)" />
        </svg>
      </div>

      <h4 className="font-bold text-[15px] text-slate-800 dark:text-white mb-0.5 tracking-tight">Need help?</h4>
      <p className="text-[11px] text-slate-500 font-medium mb-4">Please check our docs</p>

      <button className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl py-2.5 text-[13px] font-bold mb-3 transition-colors shadow-sm">
        Documentation
      </button>
    </div>
  );
}

/* ------------------- TEST HISTORY COMPONENT ------------------- */
function TestHistory({
  onCreateNew,
  tests,
  loading,
}: {
  onCreateNew: () => void;
  tests: SavedTest[];
  loading: boolean;
}) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const statusColor = (status: string) => {
    if (status === "saved")
      return "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600";
    if (status === "draft")
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-pop">
      <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
              Test History
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">{tests.length} tests found</p>
          </div>
          <GlossyButton label="Create Test" icon={Icons.Zap} small onClick={onCreateNew} isStartupsStyle />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-20 bg-black/5 dark:bg-white/5 rounded-[20px]" />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 inset-pill border-none text-slate-400 rounded-[24px] flex items-center justify-center mx-auto mb-4">
              <Icons.FileText />
            </div>
            <p className="text-slate-500 font-bold text-lg">No tests yet</p>
            <p className="text-slate-400 text-sm mt-1">Generate your first test to see it here</p>
            <div className="mt-6 flex justify-center">
              <GlossyButton label="Create First Test" icon={Icons.Zap} small onClick={onCreateNew} isStartupsStyle />
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {tests.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-black/5 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/60 transition-all group gap-3"
              >
                <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                  <div className="p-3 sm:p-4 rounded-[16px] sm:rounded-[24px] inset-pill border-none text-slate-800 dark:text-white shadow-inner shrink-0" style={{ color: "var(--theme-start)" }}>
                    <Icons.FileText />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg transition-colors truncate">
                      {t.exam_title || "Untitled Test"}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      Class {t.class_grade} · {t.subject} · {t.board} · {formatDate(t.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 ml-auto sm:ml-0 flex-shrink-0">
                  {t.total_questions > 0 && (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 inset-pill border-none px-3 py-1.5 rounded-[16px]">
                      {t.total_questions}Q · {t.total_marks}M
                    </span>
                  )}
                  <span className={`text-[10px] px-3 py-1.5 rounded-[16px] font-bold uppercase tracking-wider border ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------- CHATBOT TYPE ------------------- */
type Message = { role: "user" | "assistant" | "system"; content: string };

/* ------------------- MAIN PAGE ------------------- */
export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";

  const [activeTab, setActiveTab] = useState("dashboard");
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

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Theme configuration
  const [activeTheme, setActiveTheme] = useState<keyof typeof COLOR_SCHEMES>("black");
  const currentThemeConfig = COLOR_SCHEMES[activeTheme];

  // Data
  const [allTests, setAllTests] = useState<SavedTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);

  useScrollReveal();

  useEffect(() => {
    if (!user) return;
    setTestsLoading(true);
    supabase
      .from("tests")
      .select("id, exam_title, board, class_grade, subject, status, total_questions, total_marks, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setAllTests(data as SavedTest[]);
        setTestsLoading(false);
      });
  }, [user]);

  // Chatbot Tooltip Timer - Pops up at 2 seconds, closes 2 seconds later.
  useEffect(() => {
    const showTimer = setTimeout(() => setShowChatTooltip(true), 2000);
    const hideTimer = setTimeout(() => setShowChatTooltip(false), 4000);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  const recentTests = allTests.slice(0, 3);

  // Dynamic Dark Mode CSS Class
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatOpen]);

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

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    let apiKey = "";
    try { apiKey = import.meta.env.VITE_GROQ_API_KEY || ""; } catch (e) {}
    if (!apiKey) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Error: Missing VITE_GROQ_API_KEY" }]);
      return;
    }
    const userMsg: Message = { role: "user", content: inputMessage };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsChatLoading(true);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are a4ai Assistant for Teachers. Help them create tests and manage classes. Keep answers concise." },
            ...chatMessages.filter((m) => m.role !== "system"),
            userMsg,
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (data.choices?.[0])
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.choices[0].message.content }]);
    } catch (error: any) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${error.message || "Failed"}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

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

  // NEW LOGOUT FUNCTIONALITY
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const navItems = [
    { id: "dashboard", Icon: Icons.Grid,   label: "Dashboard",   color: "text-blue-500" },
    { id: "students",  Icon: Icons.Users,   label: "Students",     color: "text-orange-500" },
    { id: "tests",     Icon: Icons.History, label: "Test History", color: "text-rose-500" },
    { id: "analytics", Icon: Icons.Chart,   label: "Analytics",    color: "text-emerald-500" },
    { id: "ai-tools",  Icon: Icons.Brain,   label: "AI Tools",     color: "text-cyan-500" },
  ];

  return (
    <>
      {/* Wrapper to handle theming variables */}
      <div 
        className={isDarkMode ? "dark" : ""} 
        style={{
          '--theme-start': currentThemeConfig.start,
          '--theme-end': currentThemeConfig.end,
          '--theme-shadow': currentThemeConfig.shadow,
        } as React.CSSProperties}
      >
        <div className="flex h-[100dvh] w-full font-sans text-slate-800 dark:text-slate-100 overflow-hidden relative bg-[#F8F9FA] dark:bg-[#0A0A0A] transition-colors duration-500">
          <style dangerouslySetInnerHTML={{ __html: customStyles }} />

          {/* ── Auto-moving animated blobs background covering a large area ── */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div 
              className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-20 dark:opacity-[0.15] animate-blob" 
              style={{ background: 'var(--theme-start)' }}
            />
            <div 
              className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-20 dark:opacity-[0.15] animate-blob animation-delay-2000" 
              style={{ background: 'var(--theme-end)' }}
            />
            <div 
              className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-20 dark:opacity-[0.15] animate-blob animation-delay-4000" 
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
            className={`fixed lg:relative top-0 left-0 w-[288px] h-full flex flex-col bg-white/80 dark:bg-black/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-white/5 z-[200] lg:z-50 shrink-0 transform transition-transform duration-300 overflow-y-auto ${
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="p-5 pb-2">
              {/* ── LOGO (Reverted to Original Size) ── */}
              <div className="flex items-center justify-between mb-8 animate-entrance px-2 border-b border-slate-100 dark:border-white/5 pb-6" style={{ animationDelay: "100ms" }}>
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

              {/* Nav Pages */}
              <div className="animate-entrance" style={{ animationDelay: "200ms" }}>
                <nav className="space-y-1.5 mt-2">
                  {navItems.map((item) => {
                    const ItemIcon = item.Icon;
                    return (
                      <SidebarButton
                        key={item.id}
                        active={activeTab === item.id}
                        Icon={ItemIcon}
                        label={item.label}
                        colorClass={item.color}
                        onClick={() => {
                          // NAVIGATION FIX
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

            <div className="mt-auto px-5 pb-4 animate-entrance" style={{ animationDelay: "300ms" }}>
              <SubscriptionSidebarWidget navigate={navigate} />
              <SidebarHelpWidget />
            </div>
          </aside>

          {/* ===== MAIN CONTENT ===== */}
          <main className="flex-1 h-full overflow-y-auto relative z-10 scroll-smooth pb-24 sm:pb-32">
            <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto relative">

              {/* ── STICKY / ADAPTIVE HEADER ── */}
              <header
                className="sticky lg:relative top-0 z-[150] lg:z-[100] bg-white/80 dark:bg-black/80 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-b lg:border-none border-slate-200/50 dark:border-white/5 px-4 sm:px-6 lg:px-0 py-3 lg:py-0 -mx-4 sm:-mx-6 lg:mx-0 mb-6 lg:mb-12 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 lg:gap-6 animate-entrance transition-colors duration-500"
                style={{ animationDelay: "100ms" }}
              >
                {/* MOBILE TOP ROW: Menu + Logo */}
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

                {/* DESKTOP LEFT: Greeting */}
                <div className="hidden lg:flex flex-col min-w-0 w-full lg:w-auto">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                    Welcome, {getFirstName()}
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-1 sm:mt-2 font-medium truncate">
                    Here's what's happening in your classes.
                  </p>
                </div>

                {/* RIGHT / BOTTOM ROW: Search + Notif + Profile */}
                <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
                  <div className="flex-1 lg:flex-none min-w-0">
                    <SearchBar tests={allTests} onNavChange={(tab) => { setActiveTab(tab); }} />
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Notifications */}
                    <div className="relative shrink-0" ref={notifRef}>
                      <button
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className={`p-2.5 sm:p-3 rounded-[20px] sm:rounded-[24px] inset-pill transition-all relative active:scale-95 ${
                          isNotifOpen ? "text-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <Icons.Bell />
                        <span className="absolute top-2 sm:top-2.5 right-2 sm:right-2.5 w-2.5 h-2.5 bg-slate-800 dark:bg-white rounded-full border-2 border-white dark:border-black" style={{ background: "var(--theme-start)" }} />
                      </button>
                      {isNotifOpen && (
                        <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 glass-overlay rounded-[32px] sm:rounded-[40px] p-4 sm:p-5 flex flex-col gap-2 animate-pop z-[150]">
                          <div className="flex justify-between items-center mb-3 px-2">
                            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                              Notifications
                            </h3>
                            <span className="text-[10px] font-bold btn-glossy-theme px-2.5 py-1 rounded-full">
                              New
                            </span>
                          </div>
                          <div className="flex gap-3 items-start p-3 sm:p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors cursor-pointer inset-pill border-none">
                            <div className="text-slate-800 dark:text-white shrink-0 mt-0.5" style={{ color: "var(--theme-start)" }}><Icons.Check /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                Welcome to a4ai!
                              </p>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Start generating CBSE papers.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start p-3 sm:p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors cursor-pointer inset-pill border-none">
                            <div className="text-slate-800 dark:text-white shrink-0 mt-0.5" style={{ color: "var(--theme-start)" }}><Icons.Youtube /></div>
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

                    {/* ── PROFILE BUTTON ── */}
                    <div className="relative shrink-0" ref={profileRef}>
                      <button
                        onClick={() => {
                          setIsProfileOpen(!isProfileOpen);
                          if (isProfileOpen) setShowAppearance(false);
                        }}
                        className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[24px] glass-panel transition-all duration-200 hover:shadow-md active:scale-95 group ${
                          isProfileOpen ? "ring-2 ring-slate-400/50" : ""
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
                        <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 glass-overlay rounded-[32px] sm:rounded-[40px] p-3 flex flex-col gap-1 animate-pop z-[150]">
                          {/* Profile info */}
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
                              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                            </div>
                          </div>

                          {/* My Profile */}
                          <button
                            onClick={() => { navigate("/settings"); setIsProfileOpen(false); }}
                            className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <Icons.User /> My Profile
                            </div>
                            <div className="text-slate-400 group-hover:translate-x-0.5 transition-transform">
                              <Icons.ChevronRight />
                            </div>
                          </button>

                          {/* Language Selector (Simplified) */}
                          <button
                            className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <Icons.Globe /> Language
                            </div>
                            <div className="text-slate-400 group-hover:translate-x-0.5 transition-transform">
                              <Icons.ChevronRight />
                            </div>
                          </button>

                          {/* Appearance / Theme Picker */}
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
                              <div className="px-4 sm:px-5 pb-4 pt-1 flex flex-col gap-4 animate-entrance bg-black/5 dark:bg-white/5">
                                
                                {/* Dark Mode Toggle */}
                                <div className="flex items-center justify-between pt-2">
                                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Dark Mode</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }}
                                    className={`w-11 h-6 rounded-full shadow-inner relative flex items-center px-1 transition-colors duration-300 ${
                                      isDarkMode ? "bg-slate-700" : "bg-slate-300"
                                    }`}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
                                        isDarkMode ? "translate-x-5" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Color Scheme Picker - Circles 3x smaller */}
                                <div>
                                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Color Scheme</span>
                                  <div className="flex flex-wrap gap-3 place-items-center">
                                    {(Object.keys(COLOR_SCHEMES) as Array<keyof typeof COLOR_SCHEMES>).map((key) => (
                                      <button
                                        key={key}
                                        onClick={(e) => { e.stopPropagation(); setActiveTheme(key); }}
                                        className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm border-2 ${
                                          activeTheme === key ? "border-slate-800 dark:border-white scale-110" : "border-transparent"
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

                          {/* LOGOUT BUTTON FIX */}
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

              {/* MOBILE GREETING (Scrolls naturally beneath the header) */}
              <div className="lg:hidden mb-6 sm:mb-8 px-1 animate-entrance" style={{ animationDelay: "150ms" }}>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  Welcome, {getFirstName()}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-1 font-medium truncate">
                  Here's what's happening in your classes.
                </p>
              </div>

              {/* ===== DASHBOARD TAB ===== */}
              {activeTab === "dashboard" && (
                <div className="space-y-6 sm:space-y-8">

                  {/* Hero cards */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-8 scroll-reveal" style={{ transitionDelay: "0ms" }}>

                    {/* NCERT generator card */}
                    <div className="xl:col-span-2 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 lg:p-14 relative overflow-hidden flex flex-col justify-center group">
                      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/30 to-transparent pointer-events-none rounded-[48px]" />
                      <div className="relative z-10 max-w-xl">
                        <div className="flex items-center gap-2 mb-4 sm:mb-6 bg-white/60 dark:bg-black/50 border border-white/40 dark:border-white/10 w-fit px-3 sm:px-5 py-1.5 sm:py-2 rounded-[20px] sm:rounded-[24px] shadow-sm">
                          <div className="text-slate-800 dark:text-slate-200" style={{ color: "var(--theme-start)" }}><Icons.Brain /></div>
                          <span className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                            NCERT Test Generator
                          </span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight leading-[1.1]">
                          Create CBSE papers in minutes.
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

                    {/* What's New card - Reverted to vertically stacked glossy buttons */}
                    <div className="xl:col-span-1 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 flex flex-col relative overflow-hidden">
                      <div className="flex items-center gap-3 sm:gap-5 mb-6 sm:mb-8">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 inset-pill border-none flex items-center justify-center shadow-inner rounded-[24px] sm:rounded-[28px] shrink-0" style={{ color: "var(--theme-start)" }}>
                          <Icons.Sparkles />
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                          What's New
                        </h3>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
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
                        <GlossyButton
                          label="Join Institute"
                          subLabel="Enter code to join"
                          icon={Icons.Users}
                          fullWidth
                          onClick={() => navigate("/join-institute")}
                        />
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

                  {/* Stats grid */}
                  <div
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-8 scroll-reveal"
                    style={{ transitionDelay: "80ms" }}
                  >
                    {[
                      { t: "Active Students", v: "156",                          c: "+12%",      Icon: Icons.Users    },
                      { t: "Tests Created",   v: String(allTests.length || "0"), c: "All time", Icon: Icons.FileText },
                      { t: "Engagement",      v: "92%",                          c: "+3.2%",    Icon: Icons.Chart    },
                      { t: "Time Saved",      v: "8h",                           c: "This week",Icon: Icons.Clock    },
                    ].map((stat, i) => {
                      const StatIcon = stat.Icon;
                      return (
                        <div
                          key={i}
                          className="glass-panel rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col items-center text-center hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300"
                        >
                          <div className="mb-3 sm:mb-5 inset-pill p-2.5 sm:p-4 rounded-[16px] sm:rounded-[24px] border-none shrink-0 text-slate-800 dark:text-white" style={{ color: "var(--theme-start)" }}>
                            <StatIcon />
                          </div>
                          <h3 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-1 sm:mb-2">
                            {stat.v}
                          </h3>
                          <p className="text-[9px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 sm:mb-4">
                            {stat.t}
                          </p>
                          <span className="text-[10px] sm:text-xs text-slate-800 dark:text-slate-200 font-extrabold bg-slate-200/50 dark:bg-white/10 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-[16px] sm:rounded-[20px] border border-slate-300/50 dark:border-white/10">
                            {stat.c}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Institute section */}
                  <div className="scroll-reveal" style={{ transitionDelay: "140ms" }}>
                    <InstituteTeacherPanel userId={user?.id} />
                  </div>

                  {/* Recent Tests */}
                  <div
                    className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12 scroll-reveal"
                    style={{ transitionDelay: "200ms" }}
                  >
                    <div className="flex justify-between items-center mb-5 sm:mb-8">
                      <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-3xl">
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
                          <div key={i} className="animate-pulse h-20 bg-black/5 dark:bg-white/5 rounded-[20px]" />
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
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-black/5 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/60 transition-all duration-300 cursor-pointer group gap-3"
                          >
                            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                              <div className="p-3 sm:p-4 rounded-[16px] sm:rounded-[24px] inset-pill border-none text-slate-800 dark:text-white shadow-inner shrink-0" style={{ color: "var(--theme-start)" }}>
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
                            <div className="flex items-center gap-3 sm:gap-6">
                              {test.total_questions > 0 && (
                                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 inset-pill border-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-[16px] sm:rounded-[20px]">
                                  {test.total_questions}Q
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-3 py-1.5 rounded-[16px] font-bold uppercase border ${
                                  test.status === "saved"
                                    ? "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700/60 dark:text-slate-200"
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
                <div className="space-y-6 sm:space-y-8 animate-pop">
                  <InstituteTeacherPanel userId={user?.id} />
                </div>
              )}

              {/* ===== TEST HISTORY TAB ===== */}
              {activeTab === "tests" && (
                <TestHistory
                  onCreateNew={() => navigate("/dashboard/test-generator")}
                  tests={allTests}
                  loading={testsLoading}
                />
              )}

              {/* ===== ANALYTICS TAB ===== */}
              {activeTab === "analytics" && (
                <div className="space-y-6 sm:space-y-8 animate-pop">
                  <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-8 sm:p-10 min-h-[300px] sm:min-h-[500px] flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none text-slate-800 dark:text-white rounded-full flex items-center justify-center mb-6 sm:mb-8" style={{ color: "var(--theme-start)" }}>
                      <Icons.Chart />
                    </div>
                    <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3 sm:mb-4">
                      Performance Trends
                    </h3>
                    <p className="text-slate-500 font-medium max-w-sm text-sm sm:text-lg">
                      Graphs will appear after 5 tests are completed.
                    </p>
                  </div>
                </div>
              )}

              {/* ===== AI TOOLS TAB ===== */}
              {activeTab === "ai-tools" && (
                <div className="space-y-6 sm:space-y-8 animate-pop">
                  <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-5 sm:p-8 scroll-reveal" style={{ transitionDelay: "0ms" }}>
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
                      AI Utilities
                    </h2>
                    <p className="text-sm sm:text-base text-slate-500 font-medium mt-1 sm:mt-2">
                      Supercharge your teaching workflow.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                    {[
                      { Icon: Icons.Youtube,  title: "Community Quiz",  desc: "Generate quizzes from any YouTube video.", action: () => navigate("/teacher/community-quiz/new"), isNew: true, primary: true },
                      { Icon: Icons.Brain,    title: "Test Generator",  desc: "Create CBSE-pattern papers from NCERT.",   action: () => navigate("/dashboard/test-generator"), isNew: false, primary: false },
                      { Icon: Icons.FileText, title: "Auto-Grade",      desc: "AI-analyze long-form answers instantly.",  isNew: false, primary: false },
                      { Icon: Icons.Book,     title: "Study Guides",    desc: "Convert notes into smart flashcards.",     isNew: false, primary: false },
                      { Icon: Icons.Search,   title: "Plagiarism Check",desc: "Scan against web and AI datasets.",        isNew: false, primary: false },
                      { Icon: Icons.Grid,     title: "Smart Rubrics",   desc: "Generate standard-aligned rubrics.",       isNew: false, primary: false },
                      { Icon: Icons.Clock,    title: "Lesson Planner",  desc: "Plan lessons by pacing & standard.",       isNew: false, primary: false },
                    ].map((tool, i) => {
                      const ToolIcon = tool.Icon;
                      return (
                        <div
                          key={i}
                          className="glass-panel p-6 sm:p-10 rounded-[28px] sm:rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-1 sm:hover:-translate-y-2 transition-all relative overflow-hidden group scroll-reveal"
                          style={{ transitionDelay: `${60 + i * 50}ms` }}
                        >
                          {tool.isNew && (
                            <div className="absolute top-3 right-3">
                              <span className="new-badge btn-glossy-theme text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                                NEW
                              </span>
                            </div>
                          )}
                          <div
                            className={`w-14 h-14 sm:w-20 sm:h-20 inset-pill border-none text-slate-800 dark:text-white rounded-[20px] sm:rounded-[32px] flex items-center justify-center mx-auto mb-4 sm:mb-6 shrink-0`}
                            style={{ color: "var(--theme-start)" }}
                          >
                            <ToolIcon />
                          </div>
                          <h3
                            className={`text-lg sm:text-2xl font-black text-slate-900 dark:text-white mb-2 sm:mb-3 ${
                              tool.isNew ? "shimmer-text" : ""
                            }`}
                          >
                            {tool.title}
                          </h3>
                          <p className="text-xs sm:text-base text-slate-500 mb-4 sm:mb-8 font-medium">
                            {tool.desc}
                          </p>
                          <GlossyButton
                            label={tool.isNew ? "Try Now" : tool.primary ? "Create Test" : "Launch"}
                            fullWidth
                            small
                            onClick={tool.action || (() => {})}
                            showNewBadge={tool.isNew}
                            isStartupsStyle={tool.primary}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </main>

          {/* ===== CHATBOT FAB & HOVER TOOLTIP ===== */}
          <div className="fixed bottom-4 sm:bottom-8 right-4 sm:right-8 z-[110] flex flex-col items-end gap-4 sm:gap-5">
            {/* Pop-up tooltip implementation */}
            {showChatTooltip && !isChatOpen && (
              <div className="absolute bottom-full right-0 mb-4 mr-2 px-5 py-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] font-black tracking-wide text-sm border border-slate-100 dark:border-slate-700 whitespace-nowrap animate-dropIn z-[120]">
                Need any help...?
                <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white dark:bg-slate-800 rotate-45 border-b border-r border-slate-100 dark:border-slate-700"></div>
              </div>
            )}

            {isChatOpen && (
              <div className="w-[calc(100vw-2rem)] sm:w-96 h-[400px] sm:h-[450px] rounded-[32px] sm:rounded-[48px] shadow-2xl overflow-hidden flex flex-col animate-pop glass-overlay border border-black/5 dark:border-white/10">
                <div 
                  className="p-4 sm:p-5 flex justify-between items-center text-white shrink-0"
                  style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}
                >
                  <span className="font-extrabold text-sm sm:text-base flex items-center gap-2 sm:gap-3">
                    <Icons.Brain /> a4ai Assistant
                  </span>
                  <button
                    className="hover:bg-white/20 p-1.5 sm:p-2 rounded-full transition-all"
                    onClick={() => setIsChatOpen(false)}
                  >
                    <Icons.X />
                  </button>
                </div>
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 bg-black/5 dark:bg-white/5">
                  <div className="p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] rounded-tl-none max-w-[85%] text-xs sm:text-sm font-bold bg-white/80 dark:bg-black/60 backdrop-blur-md text-slate-800 dark:text-white border border-black/5 dark:border-white/10">
                    Hello! I'm your a4ai teaching assistant. How can I help?
                  </div>
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] max-w-[85%] text-xs sm:text-sm font-bold ${
                          msg.role === "user"
                            ? "text-white rounded-tr-none"
                            : "bg-white/80 dark:bg-black/60 text-slate-800 dark:text-white rounded-tl-none border border-black/5 dark:border-white/10"
                        }`}
                        style={msg.role === "user" ? { background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` } : {}}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 sm:p-4 rounded-[24px] rounded-tl-none bg-white/80 dark:bg-black/60 border border-black/5 dark:border-white/10 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Icons.Loader />
                        <span className="text-[10px] font-black uppercase tracking-widest">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 sm:p-4 shrink-0 glass-panel border-t-0 bg-white/40 dark:bg-black/40">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                      placeholder="Type a message..."
                      className="w-full text-xs sm:text-sm font-bold p-3 sm:p-4 pr-12 sm:pr-14 rounded-[24px] sm:rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-slate-400/50 text-slate-800 dark:text-white placeholder-slate-500 bg-white/80 dark:bg-black/60"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isChatLoading || !inputMessage.trim()}
                      className="absolute right-1.5 sm:right-2 p-2 sm:p-2.5 text-white rounded-[20px] sm:rounded-[24px] hover:scale-105 disabled:opacity-50 transition-all"
                      style={{ background: `linear-gradient(135deg, var(--theme-start), var(--theme-end))` }}
                    >
                      <Icons.Send />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="relative w-14 h-14 sm:w-20 sm:h-20 btn-glossy-theme rounded-[24px] sm:rounded-[32px] transition-all hover:-translate-y-2 active:scale-95 flex items-center justify-center z-10 shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
            >
              {isChatOpen ? (
                <div className="scale-100 sm:scale-125"><Icons.X /></div>
              ) : (
                <div className="scale-100 sm:scale-125"><Icons.MessageCircle /></div>
              )}
            </button>
          </div>

          {/* ===== INVITE MODAL ===== */}
          {showInviteModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-pop">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                onClick={() => setShowInviteModal(false)}
              />
              <div className="glass-overlay p-6 sm:p-10 lg:p-12 rounded-[32px] sm:rounded-[56px] w-full max-w-md relative z-10 text-center">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="absolute top-4 sm:top-8 right-4 sm:right-8 p-2 sm:p-3 text-slate-500 inset-pill border-none rounded-full hover:text-slate-800 dark:hover:text-white"
                >
                  <Icons.X />
                </button>
                {!inviteSent ? (
                  <>
                    <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none text-slate-800 dark:text-slate-200 rounded-[24px] sm:rounded-[36px] flex items-center justify-center mx-auto mb-5 sm:mb-8" style={{ color: "var(--theme-start)" }}>
                      <div className="scale-100 sm:scale-125"><Icons.Mail /></div>
                    </div>
                    <h3 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-4 text-slate-900 dark:text-white">
                      Invite Student
                    </h3>
                    <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-10 font-medium">
                      Send an email invitation to your student.
                    </p>
                    <form onSubmit={handleInvite} className="space-y-5 sm:space-y-8 text-left">
                      <div className="relative">
                        <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-500" style={{ color: "var(--theme-start)" }}>
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
                    <div className="w-20 h-20 sm:w-28 sm:h-28 bg-slate-200/50 dark:bg-white/10 text-slate-800 dark:text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-slate-300/50 dark:border-white/10" style={{ color: "var(--theme-start)" }}>
                      <div className="scale-125 sm:scale-150"><Icons.Check /></div>
                    </div>
                    <h4 className="font-black text-2xl sm:text-3xl text-slate-900 dark:text-white mb-3 sm:mb-4">Sent!</h4>
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
    </>
  );
}