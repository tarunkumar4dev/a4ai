// src/pages/TeacherDashboardPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";

/* ------------------- STYLES ------------------- */
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
  .apple-spring { transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1); }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }

  .glass-panel {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 1);
    box-shadow: 0 10px 40px -10px rgba(59, 130, 246, 0.1), inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
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
    box-shadow: 0 30px 60px -10px rgba(59, 130, 246, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-overlay {
    background: rgba(15, 23, 42, 0.90);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.7);
  }
  .inset-pill {
    background: rgba(255, 255, 255, 0.5);
    box-shadow: inset 4px 4px 10px rgba(59, 130, 246, 0.05), inset -4px -4px 10px rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.8);
  }
  .dark .inset-pill {
    background: rgba(15, 23, 42, 0.6);
    box-shadow: inset 4px 4px 10px rgba(0, 0, 0, 0.4), inset -4px -4px 10px rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .btn-glossy-blue {
    background: linear-gradient(135deg, #38BDF8 0%, #2563EB 100%);
    box-shadow: inset 0px 2px 4px rgba(255,255,255,0.4), inset 0px -2px 4px rgba(0,0,0,0.15), 0px 8px 16px rgba(37, 99, 235, 0.3);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
  }
  .btn-glossy-blue:hover { background: linear-gradient(135deg, #0EA5E9 0%, #1D4ED8 100%); }
  .btn-glossy-light {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    box-shadow: inset 0px 1px 2px rgba(255,255,255,1), 0px 4px 10px rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(255, 255, 255, 1);
    color: #1E3A8A;
  }
  .dark .btn-glossy-light {
    background: rgba(30, 41, 59, 0.6);
    box-shadow: inset 0px 1px 2px rgba(255,255,255,0.1), 0px 4px 10px rgba(0,0,0,0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #BAE6FD;
  }
  .btn-glossy-light:hover { background: rgba(255, 255, 255, 1); color: #2563EB; }
  .dark .btn-glossy-light:hover { background: rgba(51, 65, 85, 0.8); }
`;

/* ------------------- ICONS ------------------- */
const Icons = {
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Grid: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="2"/><rect width="7" height="7" x="14" y="3" rx="2"/><rect width="7" height="7" x="14" y="14" rx="2"/><rect width="7" height="7" x="3" y="14" rx="2"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  FileText: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Brain: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>,
  Zap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Trophy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Clock: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  GradCap: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  MessageCircle: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  Eye: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  Dots: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  Key: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Link: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Mail: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Menu: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  Moon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  LogOut: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  Send: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  Loader: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Globe: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
  Book: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
};

/* ------------------- REUSABLE COMPONENTS ------------------- */

const SidebarButton = ({ active, icon: Icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 rounded-[32px] font-bold text-sm transition-all duration-300 active:scale-95 ${
      active
        ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 border border-slate-200/50 dark:border-slate-600/50"
        : "text-slate-500 hover:text-blue-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
    }`}
  >
    <div className={`${active ? "scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" : ""} transition-transform shrink-0`}><Icon /></div>
    <span className="truncate">{label}</span>
  </button>
);

const GlossyButton = ({ icon: Icon, label, subLabel, variant = "blue", onClick, fullWidth = false, small = false }: any) => (
  <button
    onClick={onClick}
    className={`relative flex items-center justify-center gap-2 sm:gap-3 rounded-[32px] transform transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98] btn-glossy-${variant} ${fullWidth ? "w-full" : "w-auto"} ${small ? "px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[48px]" : "px-5 sm:px-8 py-4 sm:py-5 min-h-[56px] sm:min-h-[64px] text-base sm:text-lg"} overflow-hidden group`}
  >
    {Icon && (
      <div className={`flex items-center justify-center rounded-full ${variant === "light" ? "bg-blue-50 text-blue-600 dark:bg-slate-800/80 dark:text-blue-400" : "bg-white/20 text-white"} backdrop-blur-md ${small ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8 sm:h-10 sm:w-10"} border border-white/40 shadow-inner group-hover:scale-110 transition-transform shrink-0`}>
        <Icon size={small ? 14 : 18} />
      </div>
    )}
    <div className="flex flex-col text-left min-w-0">
      <span className="font-bold leading-none tracking-tight truncate">{label}</span>
      {subLabel && !small && <span className="mt-1 sm:mt-1.5 text-xs font-medium opacity-80 truncate">{subLabel}</span>}
    </div>
    {!small && <div className="ml-auto pl-2 sm:pl-4 opacity-50 group-hover:translate-x-1 transition-transform shrink-0"><Icons.ChevronRight /></div>}
  </button>
);

/* ------------------- SUBSCRIPTION SIDEBAR WIDGET ------------------- */

function SubscriptionSidebarWidget({ navigate }: { navigate: any }) {
  const { status, loading } = useSubscription();

  if (loading || !status) {
    return (
      <div className="bg-slate-100/80 dark:bg-slate-800/40 p-5 sm:p-6 text-center rounded-[40px] shadow-inner border border-white/60 dark:border-white/5">
        <div className="animate-pulse space-y-3">
          <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-[24px] mx-auto" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mx-auto" />
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-[32px]" />
        </div>
      </div>
    );
  }

  const isUnlimited = status.test_limit === -1;
  const isFree = status.plan_slug === "free";
  const isPro = status.plan_slug === "pro";
  const percent = isUnlimited ? 100 : Math.min(100, (status.tests_used / status.test_limit) * 100);
  const planIcon = isPro ? "🏆" : isFree ? "⚡" : "🚀";

  return (
    <div className="bg-slate-100/80 dark:bg-slate-800/40 p-5 sm:p-6 text-center rounded-[40px] shadow-inner border border-white/60 dark:border-white/5">
      <div className="mb-3 sm:mb-4 flex justify-center">
        <div className="rounded-[24px] bg-white dark:bg-slate-700 shadow-sm p-3 sm:p-4 text-2xl drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          {planIcon}
        </div>
      </div>
      <h4 className="text-slate-900 dark:text-white font-bold mb-1 text-sm sm:text-base">{status.plan_name} Plan</h4>

      {!isUnlimited ? (
        <>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-2 sm:mb-3 font-medium">
            {status.tests_used}/{status.test_limit} tests used
          </p>
          <div className="h-2 bg-white/60 dark:bg-slate-700 rounded-full overflow-hidden mb-4 sm:mb-5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-gradient-to-r from-sky-400 to-blue-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm mb-4 sm:mb-5 font-bold">Unlimited tests ✨</p>
      )}

      {!isPro && (
        <GlossyButton
          label={isFree ? "Upgrade to Starter" : "Upgrade to Pro"}
          variant="blue"
          small
          fullWidth
          onClick={() => navigate("/payment")}
        />
      )}
    </div>
  );
}

/* ------------------- CHATBOT ------------------- */
type Message = { role: "user" | "assistant" | "system"; content: string };

/* ------------------- MAIN PAGE ------------------- */
export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const profile = { full_name: "Tarun Sharma", email: "tarun.s@school.edu", coins: 250 };

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState("EN");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
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
          messages: [{ role: "system", content: "You are a4ai Assistant for Teachers. Help them create tests and manage classes. Keep answers concise." }, ...chatMessages.filter((m) => m.role !== "system"), userMsg],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (data.choices?.[0]) setChatMessages((prev) => [...prev, { role: "assistant", content: data.choices[0].message.content }]);
    } catch (error: any) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${error.message || "Failed"}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const [tests] = useState([
    { id: 1, name: "Physics Midterm", date: "May 14, 2025", class: "10A", status: "Published", avg: 78, isPrivate: true, code: "PHY-9X2" },
    { id: 2, name: "Calculus Quiz", date: "May 10, 2025", class: "11B", status: "Draft", avg: null, isPrivate: false, code: null },
    { id: 3, name: "Chemistry Lab", date: "May 02, 2025", class: "10B", status: "Graded", avg: 82, isPrivate: true, code: "CHM-4B1" },
  ]);

  const [students, setStudents] = useState([
    { id: 1, name: "Sarah Johnson", email: "sarah.j@student.edu", class: "10A", score: 94, status: "Excellent" },
    { id: 2, name: "Michael Chen", email: "m.chen@student.edu", class: "11B", score: 87, status: "Good" },
    { id: 3, name: "Emma Williams", email: "emma.w@student.edu", class: "10B", score: 72, status: "Needs Help" },
  ]);

  const filteredStudents = students.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()));
  const removeStudent = (id: number) => setStudents(students.filter((s) => s.id !== id));
  const getFirstName = () => profile?.full_name?.split(" ")[0] || "Educator";

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSent(true);
    setTimeout(() => { setInviteSent(false); setShowInviteModal(false); setInviteEmail(""); }, 2000);
  };

  const navItems = [
    { id: "dashboard", icon: Icons.Grid, label: "Dashboard" },
    { id: "students", icon: Icons.Users, label: "Students" },
    { id: "tests", icon: Icons.History, label: "Test History" },
    { id: "analytics", icon: Icons.Chart, label: "Analytics" },
    { id: "ai-tools", icon: Icons.Brain, label: "AI Tools" },
  ];

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="flex h-[100dvh] w-full font-sans text-slate-800 dark:text-slate-100 overflow-hidden relative bg-slate-100 dark:bg-slate-900 transition-colors duration-500">
        <style>{customStyles}</style>

        {/* Ambient lights */}
        <div className="absolute top-0 left-0 w-full h-[70vh] bg-gradient-to-b from-sky-200/90 via-blue-100/40 to-transparent dark:from-blue-900/60 dark:via-blue-900/20 pointer-events-none z-0" />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[40rem] sm:w-[60rem] h-[20rem] sm:h-[30rem] bg-sky-300/40 dark:bg-blue-800/40 rounded-full filter blur-[100px] pointer-events-none z-0" />

        {/* Mobile backdrop */}
        {mobileMenuOpen && <div className="fixed inset-0 bg-white/20 dark:bg-black/60 backdrop-blur-md z-[190] lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

        {/* ===== SIDEBAR ===== */}
        <aside className={`fixed lg:relative top-0 left-0 w-[280px] sm:w-[300px] h-full flex flex-col bg-slate-50 dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800 z-[200] lg:z-50 shrink-0 transform transition-transform duration-300 overflow-y-auto ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="p-5 sm:p-8 pb-4">
            <div className="flex items-center justify-between mb-8 sm:mb-10 animate-entrance" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3">
                <img src="/ICON.ico" alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" onError={(e: any) => { e.currentTarget.style.display = "none"; }} />
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white">a4ai</span>
              </div>
              <button className="lg:hidden text-slate-500 bg-white/50 p-2 rounded-full" onClick={() => setMobileMenuOpen(false)}><Icons.X /></button>
            </div>

            <div className="bg-slate-100/80 dark:bg-slate-800/40 p-2.5 sm:p-3 rounded-[40px] shadow-inner border border-white/60 dark:border-white/5 animate-entrance" style={{ animationDelay: "200ms" }}>
              <nav className="space-y-1.5 sm:space-y-2">
                {navItems.map((item) => (
                  <SidebarButton key={item.id} active={activeTab === item.id} icon={item.icon} label={item.label} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} />
                ))}
              </nav>
            </div>
          </div>

          <div className="mt-auto p-5 sm:p-8 pt-4 animate-entrance" style={{ animationDelay: "300ms" }}>
            <SubscriptionSidebarWidget navigate={navigate} />
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1 h-full overflow-y-auto relative z-10 scroll-smooth pb-24 sm:pb-32">
          <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto relative">

            {/* Header */}
            <header className="relative z-[100] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-8 sm:mb-12 animate-entrance" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
                <button className="lg:hidden p-2.5 sm:p-3 text-blue-600 glass-panel rounded-[20px] sm:rounded-[24px] shrink-0" onClick={() => setMobileMenuOpen(true)}>
                  <Icons.Menu />
                </button>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                    {activeTab === "profile" ? "Your Profile" : `Welcome, ${getFirstName()}`}
                  </h1>
                  <p className="text-slate-600 dark:text-blue-200/70 text-sm sm:text-base mt-1 sm:mt-2 font-medium truncate">
                    {activeTab === "profile" ? "Manage your account settings." : "Here's what's happening in your classes."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
                {/* Search - desktop only */}
                <div className="hidden md:flex items-center inset-pill rounded-full p-1.5 w-48 lg:w-60">
                  <div className="pl-3 text-sky-500"><Icons.Search /></div>
                  <input type="text" placeholder="Search..." className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white px-2 placeholder-slate-400" />
                </div>

                {/* Notifications */}
                <div className="relative shrink-0" ref={notifRef}>
                  <button onClick={() => setIsNotifOpen(!isNotifOpen)} className={`p-2.5 sm:p-3 rounded-[20px] sm:rounded-[24px] inset-pill transition-all relative active:scale-95 ${isNotifOpen ? "text-blue-600" : "text-slate-500 dark:text-slate-300"}`}>
                    <Icons.Bell />
                    <span className="absolute top-2 sm:top-2.5 right-2 sm:right-2.5 w-2.5 h-2.5 bg-gradient-to-tr from-sky-400 to-blue-600 rounded-full border-2 border-white shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  </button>
                  {isNotifOpen && (
                    <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 glass-overlay rounded-[32px] sm:rounded-[40px] p-4 sm:p-5 flex flex-col gap-2 animate-pop z-[150]">
                      <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Notifications</h3>
                        <span className="text-[10px] font-bold btn-glossy-blue px-2.5 py-1 rounded-full">3 New</span>
                      </div>
                      {[
                        { icon: <Icons.Users />, title: "New Student Joined", desc: "Emma Williams enrolled in 10B." },
                        { icon: <Icons.Check />, title: "Test Auto-Graded", desc: "Physics Midterm grading complete." },
                      ].map((n, idx) => (
                        <div key={idx} className="flex gap-3 items-start p-3 sm:p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors cursor-pointer inset-pill border-none group">
                          <div className="text-blue-500 shrink-0 mt-0.5">{n.icon}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{n.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Profile */}
                <div className="relative shrink-0" ref={profileRef}>
                  <div onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-300/50 dark:border-slate-600/50 cursor-pointer group">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate max-w-[120px]">{profile.full_name}</p>
                      <p className="text-xs text-slate-500 font-medium">Educator</p>
                    </div>
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-[20px] sm:rounded-[24px] inset-pill flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold group-hover:scale-105 transition-all shrink-0">
                      <Icons.GradCap />
                    </div>
                  </div>
                  {isProfileOpen && (
                    <div className="absolute right-0 top-full mt-3 w-64 sm:w-72 glass-overlay rounded-[32px] sm:rounded-[40px] p-3 flex flex-col gap-1.5 sm:gap-2 animate-pop z-[150]">
                      <div className="px-4 sm:px-5 py-3 sm:py-4 mb-1 sm:mb-2 inset-pill rounded-[28px] sm:rounded-[32px] border-none">
                        <p className="font-extrabold text-slate-800 dark:text-white text-base sm:text-lg truncate">{profile.full_name}</p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1"><Icons.Zap /> {profile.coins} Coins</p>
                      </div>
                      <button onClick={() => { setActiveTab("profile"); setIsProfileOpen(false); }} className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors">
                        <Icons.User /> Profile
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors">
                        <div className="flex items-center gap-3"><Icons.Moon /> Dark Mode</div>
                        <div className={`w-11 h-6 rounded-full shadow-inner relative flex items-center px-1 transition-colors ${isDarkMode ? "bg-blue-500" : "bg-slate-300"}`}>
                          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isDarkMode ? "translate-x-5" : "translate-x-0"}`} />
                        </div>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setLanguage((l) => (l === "EN" ? "HI" : "EN")); }} className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[24px] sm:rounded-[28px] transition-colors">
                        <div className="flex items-center gap-3"><Icons.Globe /> Language</div>
                        <span className="text-xs font-bold inset-pill px-2.5 py-1 rounded-full text-blue-600 border-none">{language}</span>
                      </button>
                      <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 my-1 mx-4" />
                      <button onClick={() => navigate("/login")} className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-[24px] sm:rounded-[28px] transition-colors"><Icons.LogOut /> Logout</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* ===== DASHBOARD TAB ===== */}
            {activeTab === "dashboard" && (
              <div className="space-y-6 sm:space-y-8 animate-entrance">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-8">
                  {/* Hero */}
                  <div className="xl:col-span-2 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 lg:p-14 relative overflow-hidden flex flex-col justify-center group">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/60 to-transparent pointer-events-none rounded-[48px]" />
                    <div className="relative z-10 max-w-xl">
                      <div className="flex items-center gap-2 mb-4 sm:mb-6 bg-white/50 dark:bg-slate-800/50 border border-white/80 w-fit px-3 sm:px-5 py-1.5 sm:py-2 rounded-[20px] sm:rounded-[24px] shadow-sm">
                        <div className="text-blue-500"><Icons.Brain /></div>
                        <span className="text-[10px] sm:text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">NCERT Test Generator</span>
                      </div>
                      <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-4 sm:mb-6 tracking-tight leading-[1.1]">
                        Create CBSE papers in minutes.
                      </h2>
                      <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg mb-6 sm:mb-10 font-medium">
                        Pick chapters, set marks — get a section-wise paper with answer key, ready to print.
                      </p>
                      <GlossyButton label="Create Test" variant="blue" icon={Icons.Zap} onClick={() => navigate("/dashboard/test-generator")} />
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="xl:col-span-1 glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 flex flex-col">
                    <div className="flex items-center gap-3 sm:gap-5 mb-6 sm:mb-8">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 inset-pill border-none flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner rounded-[24px] sm:rounded-[32px] shrink-0"><Icons.Trophy /></div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Quick Actions</h3>
                    </div>
                    <div className="space-y-3 sm:space-y-5">
                      <GlossyButton label="New Test" subLabel="NCERT-based Generator" variant="light" icon={Icons.Plus} fullWidth onClick={() => navigate("/dashboard/test-generator")} />
                      <GlossyButton label="Host Contest" subLabel="Start Live Competition" variant="light" icon={Icons.Trophy} fullWidth onClick={() => navigate("/contests")} />
                      <GlossyButton label="Analytics" subLabel="View Student Reports" variant="light" icon={Icons.Chart} fullWidth onClick={() => setActiveTab("analytics")} />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-8">
                  {[
                    { t: "Active Students", v: "156", c: "+12%", i: Icons.Users },
                    { t: "Tests Created", v: "24", c: "+5", i: Icons.FileText },
                    { t: "Engagement", v: "92%", c: "+3.2%", i: Icons.Chart },
                    { t: "Time Saved", v: "8h", c: "This week", i: Icons.Clock },
                  ].map((stat, i) => (
                    <div key={i} className="glass-panel rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col items-center text-center hover:-translate-y-1 sm:hover:-translate-y-2 transition-all duration-300">
                      <div className="text-blue-500 mb-3 sm:mb-5 inset-pill p-2.5 sm:p-4 rounded-[16px] sm:rounded-[24px] border-none shrink-0"><stat.i /></div>
                      <h3 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-1 sm:mb-2">{stat.v}</h3>
                      <p className="text-[9px] sm:text-[11px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest mb-2 sm:mb-4">{stat.t}</p>
                      <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-300 font-extrabold bg-blue-100 dark:bg-blue-900/40 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-[16px] sm:rounded-[20px] border border-blue-200 dark:border-blue-700/50">{stat.c}</span>
                    </div>
                  ))}
                </div>

                {/* Recent Tests */}
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12">
                  <div className="flex justify-between items-center mb-5 sm:mb-8">
                    <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-3xl">Recent Tests</h3>
                    <button onClick={() => setActiveTab("tests")} className="inset-pill text-blue-600 dark:text-blue-300 px-4 sm:px-6 py-2 sm:py-3 rounded-[20px] sm:rounded-[24px] font-bold text-xs hover:bg-white/80 transition-colors border-none">View All</button>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {tests.slice(0, 3).map((test) => (
                      <div key={test.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 hover:bg-white/80 transition-all duration-300 cursor-pointer group gap-3">
                        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                          <div className="p-3 sm:p-4 rounded-[16px] sm:rounded-[24px] inset-pill border-none text-blue-500 shadow-inner shrink-0"><Icons.FileText /></div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-xl group-hover:text-blue-600 transition-colors truncate">{test.name}</h4>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">Class {test.class} • {test.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-6 ml-auto sm:ml-0">
                          {test.avg && <span className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300 inset-pill border-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-[16px] sm:rounded-[20px]">Avg: {test.avg}%</span>}
                          <button className="text-slate-400 hover:text-blue-600 transition-colors p-2 sm:p-3 inset-pill border-none rounded-[16px] sm:rounded-[20px]"><Icons.Eye /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== STUDENTS TAB ===== */}
            {activeTab === "students" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">Students</h2>
                    <GlossyButton label="Invite" variant="blue" icon={Icons.Plus} small onClick={() => setShowInviteModal(true)} />
                  </div>

                  <div className="relative mb-5 sm:mb-8">
                    <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-sky-500"><Icons.Search /></div>
                    <input type="text" placeholder="Search by name..." className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-3.5 sm:py-5 text-sm inset-pill rounded-[24px] sm:rounded-[32px] focus:outline-none focus:ring-2 focus:ring-sky-400/50 text-slate-800 dark:text-white placeholder-slate-400 font-bold" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                  </div>

                  {/* Mobile cards / Desktop table */}
                  <div className="hidden md:block overflow-x-auto rounded-[32px] sm:rounded-[40px] border border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/20 backdrop-blur-md">
                    <table className="w-full text-left border-collapse">
                      <thead className="text-xs text-slate-500 dark:text-slate-300 bg-white/60 dark:bg-slate-800/40 uppercase tracking-widest font-black border-b border-white/60 dark:border-slate-700/50">
                        <tr><th className="py-5 pl-8">Student</th><th className="py-5">Class</th><th className="py-5">Score</th><th className="py-5">Status</th><th className="py-5 text-right pr-8">Action</th></tr>
                      </thead>
                      <tbody className="text-sm">
                        {filteredStudents.map((s) => (
                          <tr key={s.id} className="border-b border-white/40 dark:border-slate-700/30 hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors group">
                            <td className="py-4 pl-8">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-[20px] inset-pill border-none flex items-center justify-center font-black text-blue-600 text-lg shrink-0">{s.name.charAt(0)}</div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-900 dark:text-white truncate">{s.name}</p>
                                  <p className="text-xs text-slate-500 truncate">{s.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 font-bold text-slate-500">{s.class}</td>
                            <td className="py-4 font-black text-slate-900 dark:text-white text-lg">{s.score}%</td>
                            <td className="py-4">
                              <span className={`text-[10px] px-3 py-1.5 rounded-[16px] font-bold uppercase tracking-wider border ${s.status === "Excellent" ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300" : s.status === "Good" ? "bg-white/60 text-slate-700 border-white/80 dark:bg-slate-800/40 dark:text-slate-300" : "bg-white/40 text-slate-500 border-white/50 dark:bg-slate-900/40 dark:text-slate-400"}`}>{s.status}</span>
                            </td>
                            <td className="py-4 text-right pr-8">
                              <button onClick={() => removeStudent(s.id)} className="p-2 text-slate-400 hover:text-red-500 inset-pill border-none rounded-[16px] opacity-0 group-hover:opacity-100 transition-all"><Icons.Trash /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile student cards */}
                  <div className="md:hidden space-y-3">
                    {filteredStudents.map((s) => (
                      <div key={s.id} className="p-4 rounded-[24px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-[20px] inset-pill border-none flex items-center justify-center font-black text-blue-600 text-lg shrink-0">{s.name.charAt(0)}</div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{s.name}</p>
                              <p className="text-xs text-slate-500 truncate">{s.email}</p>
                            </div>
                          </div>
                          <button onClick={() => removeStudent(s.id)} className="p-2 text-slate-400 hover:text-red-500 shrink-0"><Icons.Trash /></button>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500 font-medium">Class {s.class}</span>
                          <span className="font-black text-slate-900 dark:text-white">{s.score}%</span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase border ${s.status === "Excellent" ? "bg-blue-100 text-blue-700 border-blue-200" : s.status === "Good" ? "bg-white/60 text-slate-700 border-white/80" : "bg-white/40 text-slate-500 border-white/50"}`}>{s.status}</span>
                        </div>
                      </div>
                    ))}
                    {filteredStudents.length === 0 && <p className="text-center py-10 text-slate-500 font-medium">No students found.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ===== TESTS TAB ===== */}
            {activeTab === "tests" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-5 sm:p-8 lg:p-12">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">Test History</h2>
                    <GlossyButton label="Create Test" variant="blue" icon={Icons.Zap} small onClick={() => navigate("/dashboard/test-generator")} />
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {tests.map((t) => (
                      <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 hover:bg-white/80 transition-all group gap-3">
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg group-hover:text-blue-600 transition-colors truncate">{t.name}</p>
                          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 font-medium">Class {t.class} • {t.date}</p>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4">
                          {t.code && (
                            <span className="font-mono text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-200 inset-pill px-3 py-1.5 rounded-[16px] border-none tracking-widest">{t.code}</span>
                          )}
                          <button className="text-xs sm:text-sm text-blue-600 font-bold inset-pill border-none px-3 sm:px-5 py-2 sm:py-3 rounded-[16px] sm:rounded-[24px] hover:scale-105 transition-transform">View</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== ANALYTICS TAB ===== */}
            {activeTab === "analytics" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
                  <div className="md:col-span-2 glass-panel rounded-[32px] sm:rounded-[48px] p-8 sm:p-10 min-h-[300px] sm:min-h-[500px] flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none text-blue-500 rounded-full flex items-center justify-center mb-6 sm:mb-8"><Icons.Chart /></div>
                    <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3 sm:mb-4">Performance Trends</h3>
                    <p className="text-slate-500 font-medium max-w-sm text-sm sm:text-lg">Graphs will appear after 5 tests are completed.</p>
                  </div>
                  <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 flex flex-col gap-5 sm:gap-8">
                    <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-2xl">Top Performers</h3>
                    {students.map((s, idx) => (
                      <div key={s.id} className="flex items-center gap-3 sm:gap-5 inset-pill border-none p-3 sm:p-5 rounded-[24px] sm:rounded-[32px]">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center font-black text-lg sm:text-xl border border-white/20 shrink-0">{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-lg truncate">{s.name}</p>
                          <div className="h-2 sm:h-3 bg-white/60 dark:bg-slate-800/50 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full" style={{ width: `${s.score}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== AI TOOLS TAB ===== */}
            {activeTab === "ai-tools" && (
              <div className="space-y-6 sm:space-y-8 animate-pop">
                <div className="glass-panel rounded-[28px] sm:rounded-[40px] p-5 sm:p-8">
                  <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">AI Utilities</h2>
                  <p className="text-sm sm:text-base text-slate-500 font-medium mt-1 sm:mt-2">Supercharge your teaching workflow.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                  {[
                    { icon: Icons.Brain, title: "Test Generator", desc: "Create CBSE-pattern papers from NCERT.", action: () => navigate("/dashboard/test-generator"), primary: true },
                    { icon: Icons.FileText, title: "Auto-Grade", desc: "AI-analyze long-form answers instantly." },
                    { icon: Icons.Book, title: "Study Guides", desc: "Convert notes into smart flashcards." },
                    { icon: Icons.Search, title: "Plagiarism Check", desc: "Scan against web and AI datasets." },
                    { icon: Icons.Grid, title: "Smart Rubrics", desc: "Generate standard-aligned rubrics." },
                    { icon: Icons.Clock, title: "Lesson Planner", desc: "Plan lessons by pacing & standard." },
                  ].map((tool, i) => (
                    <div key={i} className="glass-panel p-6 sm:p-10 rounded-[28px] sm:rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-1 sm:hover:-translate-y-2 transition-all relative overflow-hidden group">
                      {tool.primary && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />}
                      <div className="w-14 h-14 sm:w-20 sm:h-20 inset-pill border-none text-blue-600 rounded-[20px] sm:rounded-[32px] flex items-center justify-center mx-auto mb-4 sm:mb-6 shrink-0"><tool.icon /></div>
                      <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mb-2 sm:mb-3">{tool.title}</h3>
                      <p className="text-xs sm:text-base text-slate-500 mb-4 sm:mb-8 font-medium">{tool.desc}</p>
                      <GlossyButton label={tool.primary ? "Create Test" : "Launch"} variant={tool.primary ? "blue" : "light"} fullWidth small onClick={tool.action} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== PROFILE TAB ===== */}
            {activeTab === "profile" && (
              <div className="space-y-6 sm:space-y-8 animate-pop max-w-4xl mx-auto">
                <div className="glass-panel rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 lg:p-14 relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10">
                    <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-[28px] sm:rounded-[40px] inset-pill border-none flex items-center justify-center text-blue-600 shrink-0">
                      <div className="scale-125 sm:scale-150"><Icons.GradCap /></div>
                    </div>
                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-2 sm:mb-3 truncate">{profile.full_name}</h2>
                      <p className="text-base sm:text-xl text-slate-500 font-medium mb-5 sm:mb-8">Senior Educator</p>
                      <div className="flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4">
                        <span className="px-4 sm:px-5 py-2 sm:py-3 inset-pill border-none text-slate-800 dark:text-slate-200 rounded-[20px] sm:rounded-[24px] font-bold text-xs sm:text-sm flex items-center gap-2 sm:gap-3"><Icons.Mail /> {profile.email}</span>
                        <span className="px-4 sm:px-5 py-2 sm:py-3 bg-blue-100 text-blue-700 border border-blue-200/50 rounded-[20px] sm:rounded-[24px] font-bold text-xs sm:text-sm flex items-center gap-2 sm:gap-3 dark:bg-blue-900/40 dark:text-blue-300"><Icons.Zap /> {profile.coins} Coins</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ===== CHATBOT FAB ===== */}
        <div className="fixed bottom-4 sm:bottom-8 right-4 sm:right-8 z-[110] flex flex-col items-end gap-4 sm:gap-5">
          {isChatOpen && (
            <div className="w-[calc(100vw-2rem)] sm:w-96 h-[400px] sm:h-[450px] rounded-[32px] sm:rounded-[48px] shadow-[0_30px_60px_rgba(59,130,246,0.15)] overflow-hidden flex flex-col animate-pop glass-overlay border border-white/60">
              <div className="bg-gradient-to-r from-sky-400 to-blue-600 p-4 sm:p-5 flex justify-between items-center text-white shrink-0">
                <span className="font-extrabold text-sm sm:text-base flex items-center gap-2 sm:gap-3"><Icons.Brain /> a4ai Assistant</span>
                <button className="hover:bg-white/20 p-1.5 sm:p-2 rounded-full transition-all" onClick={() => setIsChatOpen(false)}><Icons.X /></button>
              </div>
              <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 bg-white/10 dark:bg-black/10">
                <div className="p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] rounded-tl-none max-w-[85%] text-xs sm:text-sm font-bold bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white border border-white/80">
                  Hello! I'm your a4ai teaching assistant. How can I help?
                </div>
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] max-w-[85%] text-xs sm:text-sm font-bold ${msg.role === "user" ? "bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-tr-none" : "bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-white rounded-tl-none border border-white/80"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="p-3 sm:p-4 rounded-[24px] rounded-tl-none bg-white/80 dark:bg-slate-800/80 border border-white/80 flex items-center gap-2 text-blue-600">
                      <Icons.Loader /><span className="text-[10px] font-black uppercase tracking-widest">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 sm:p-4 shrink-0 glass-panel border-t-0 bg-white/40 dark:bg-black/20">
                <div className="relative flex items-center">
                  <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }} placeholder="Type a message..." className="w-full text-xs sm:text-sm font-bold p-3 sm:p-4 pr-12 sm:pr-14 rounded-[24px] sm:rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 text-slate-800 dark:text-white placeholder-slate-500 bg-white/80 dark:bg-slate-800/80" />
                  <button onClick={handleSendMessage} disabled={isChatLoading || !inputMessage.trim()} className="absolute right-1.5 sm:right-2 p-2 sm:p-2.5 bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-[20px] sm:rounded-[24px] hover:scale-105 disabled:opacity-50 transition-all">
                    <Icons.Send />
                  </button>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => setIsChatOpen(!isChatOpen)} className="w-14 h-14 sm:w-20 sm:h-20 btn-glossy-blue rounded-[24px] sm:rounded-[32px] transition-all hover:-translate-y-2 active:scale-95 flex items-center justify-center">
            {isChatOpen ? <div className="scale-100 sm:scale-125"><Icons.X /></div> : <div className="scale-100 sm:scale-125"><Icons.MessageCircle /></div>}
          </button>
        </div>

        {/* ===== INVITE MODAL ===== */}
        {showInviteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-pop">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={() => setShowInviteModal(false)} />
            <div className="glass-overlay p-6 sm:p-10 lg:p-12 rounded-[32px] sm:rounded-[56px] w-full max-w-md relative z-10 text-center">
              <button onClick={() => setShowInviteModal(false)} className="absolute top-4 sm:top-8 right-4 sm:right-8 p-2 sm:p-3 text-slate-400 inset-pill border-none rounded-full hover:text-blue-600"><Icons.X /></button>
              {!inviteSent ? (
                <>
                  <div className="w-16 h-16 sm:w-24 sm:h-24 inset-pill border-none text-blue-600 rounded-[24px] sm:rounded-[36px] flex items-center justify-center mx-auto mb-5 sm:mb-8"><div className="scale-100 sm:scale-125"><Icons.Mail /></div></div>
                  <h3 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-4 text-slate-900 dark:text-white">Invite Student</h3>
                  <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-10 font-medium">Send an email invitation to your student.</p>
                  <form onSubmit={handleInvite} className="space-y-5 sm:space-y-8 text-left">
                    <div className="relative">
                      <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-sky-400"><Icons.Mail /></div>
                      <input required type="email" placeholder="Email Address" className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-4 sm:py-5 rounded-[24px] sm:rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 font-bold text-slate-800 dark:text-white placeholder-slate-400" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                    </div>
                    <GlossyButton label="Send Invitation" variant="blue" fullWidth />
                  </form>
                </>
              ) : (
                <div className="py-8 sm:py-10">
                  <div className="w-20 h-20 sm:w-28 sm:h-28 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-blue-200/50"><div className="scale-125 sm:scale-150"><Icons.Check /></div></div>
                  <h4 className="font-black text-2xl sm:text-3xl text-slate-900 dark:text-white mb-3 sm:mb-4">Sent!</h4>
                  <p className="text-slate-500 font-medium text-sm sm:text-lg">They'll appear once they join.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}