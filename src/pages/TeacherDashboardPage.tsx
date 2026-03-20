// src/pages/TeacherDashboardPage.tsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/* ------------------- ADVANCED GLASS, MESH & ANIMATION CSS ------------------- */
const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .animate-entrance { 
    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
    opacity: 0; 
  }
  .animate-pop {
    animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* Ultra-smooth scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.4); }
  .dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }

  /* Apple-like Spring Transition */
  .apple-spring {
    transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* =========================================
     TACTILE GLASSMORPHISM & NEUMORPHISM
     ========================================= */
  
  /* Main Frosty Panels (Clean White Glass on Grey Bg) */
  .glass-panel {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 1);
    box-shadow: 
      0 10px 40px -10px rgba(59, 130, 246, 0.1),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-panel {
    background: rgba(30, 41, 59, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 10px 40px -10px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }

  /* HIGH OPACITY OVERLAYS (For Dropdowns, Modals, and Chatbot) */
  .glass-overlay {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(48px);
    -webkit-backdrop-filter: blur(48px);
    border: 1px solid rgba(255, 255, 255, 1);
    box-shadow: 
      0 30px 60px -10px rgba(59, 130, 246, 0.2),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
  }
  .dark .glass-overlay {
    background: rgba(15, 23, 42, 0.90);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-top: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: 
      0 30px 60px -10px rgba(0, 0, 0, 0.7),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
  }

  /* Inset Containers (Inputs, Search, Pills) */
  .inset-pill {
    background: rgba(255, 255, 255, 0.5);
    box-shadow: 
      inset 4px 4px 10px rgba(59, 130, 246, 0.05),
      inset -4px -4px 10px rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.8);
  }
  .dark .inset-pill {
    background: rgba(15, 23, 42, 0.6);
    box-shadow: 
      inset 4px 4px 10px rgba(0, 0, 0, 0.4),
      inset -4px -4px 10px rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Glowing Sky Blue Buttons */
  .btn-glossy-blue {
    background: linear-gradient(135deg, #38BDF8 0%, #2563EB 100%);
    box-shadow: 
      inset 0px 2px 4px rgba(255,255,255,0.4),
      inset 0px -2px 4px rgba(0,0,0,0.15),
      0px 8px 16px rgba(37, 99, 235, 0.3);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
  }
  .btn-glossy-blue:hover { 
    background: linear-gradient(135deg, #0EA5E9 0%, #1D4ED8 100%); 
    box-shadow: 0px 10px 20px rgba(37, 99, 235, 0.4), inset 0px 2px 4px rgba(255,255,255,0.5);
  }

  /* Light Accent Buttons */
  .btn-glossy-light {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    box-shadow: 
      inset 0px 1px 2px rgba(255,255,255,1),
      0px 4px 10px rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(255, 255, 255, 1);
    color: #1E3A8A; 
  }
  .dark .btn-glossy-light {
    background: rgba(30, 41, 59, 0.6);
    box-shadow: 
      inset 0px 1px 2px rgba(255,255,255,0.1),
      0px 4px 10px rgba(0,0,0,0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #BAE6FD;
  }
  .btn-glossy-light:hover { background: rgba(255, 255, 255, 1); color: #2563EB; }
  .dark .btn-glossy-light:hover { background: rgba(51, 65, 85, 0.8); }
`;

/* ------------------- NATIVE ICONS ------------------- */
const Icons = {
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Grid: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="2"/><rect width="7" height="7" x="14" y="3" rx="2"/><rect width="7" height="7" x="14" y="14" rx="2"/><rect width="7" height="7" x="3" y="14" rx="2"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  FileText: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
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
  Book: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
};

/* ------------------- UI COMPONENTS ------------------- */

const SidebarButton = ({ active, icon: Icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-5 py-4 rounded-[32px] font-bold text-sm transition-all duration-300 active:scale-95 ${
      active 
        ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 border border-slate-200/50 dark:border-slate-600/50" 
        : "text-slate-500 hover:text-blue-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
    }`}
  >
    <div className={`${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]' : ''} transition-transform`}><Icon /></div>
    <span>{label}</span>
  </button>
);

const GlossyButton = ({ icon: Icon, label, subLabel, variant = "blue", onClick, fullWidth = false, small = false }: any) => {
  return (
    <button onClick={onClick} className={`relative flex items-center justify-center gap-3 rounded-[32px] transform transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98] btn-glossy-${variant} ${fullWidth ? "w-full" : "w-auto"} ${small ? "px-5 py-3 min-h-[48px]" : "px-8 py-5 min-h-[64px] text-lg"} overflow-hidden group`}>
      {Icon && (
        <div className={`flex items-center justify-center rounded-full ${variant === 'light' ? 'bg-blue-50 text-blue-600 dark:bg-slate-800/80 dark:text-blue-400' : 'bg-white/20 text-white'} backdrop-blur-md ${small ? 'h-8 w-8' : 'h-10 w-10'} border border-white/40 shadow-inner group-hover:scale-110 transition-transform`}>
          <Icon size={small ? 14 : 18} />
        </div>
      )}
      <div className="flex flex-col text-left">
        <span className={`font-bold leading-none tracking-tight`}>{label}</span>
        {subLabel && !small && <span className="mt-1.5 text-xs font-medium opacity-80">{subLabel}</span>}
      </div>
      {!small && <div className="ml-auto pl-4 opacity-50 group-hover:translate-x-1 transition-transform"><Icons.ChevronRight /></div>}
    </button>
  );
};

// --- CHAT INTERFACE TYPES & CONFIG ---
type Message = { role: 'user' | 'assistant' | 'system'; content: string; };
const AI_CONFIG = { apiKey: import.meta.env.VITE_GROQ_API_KEY, model: "llama-3.3-70b-versatile" };

/* ------------------- MAIN APP ------------------- */

export default function TeacherDashboardPage() {
  const navigate = useNavigate(); 
  const profile = { full_name: "Tarun Sharma", email: "tarun.s@school.edu", coins: 250 }; 

  // States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [language, setLanguage] = useState("EN");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Dropdowns
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  
  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const stickySearchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
          (searchRef.current && !searchRef.current.contains(event.target as Node)) &&
          (stickySearchRef.current && !stickySearchRef.current.contains(event.target as Node))
      ) {
          setShowSearchSuggestions(false);
          setIsSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
      setIsScrolled(e.currentTarget.scrollTop > 60);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    let apiKey = "";
    try { apiKey = import.meta.env.VITE_GROQ_API_KEY || ""; } catch (e) {}

    if (!apiKey) {
       setChatMessages(prev => [...prev, { role: 'assistant', content: "Error: Missing VITE_GROQ_API_KEY in .env.local" }]);
       return;
    }

    const userMsg: Message = { role: 'user', content: inputMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage("");
    setIsChatLoading(true);

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", 
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: AI_CONFIG.model, 
                messages: [
                    { role: "system", content: `You are a4ai Assistant for Teachers. Help them create tests and manage classes. Keep answers concise and helpful.` },
                    ...chatMessages.filter(m => m.role !== 'system'), 
                    userMsg
                ], 
                temperature: 0.7, 
                max_tokens: 1024
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        if (data.choices && data.choices[0]) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }]);
        }
    } catch (error: any) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message || "Failed to connect"}.` }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const [tests, setTests] = useState([
    { id: 1, name: "Physics Midterm", date: "May 14, 2025", class: "10A", status: "Published", avg: 78, isPrivate: true, code: "PHY-9X2" },
    { id: 2, name: "Calculus Quiz", date: "May 10, 2025", class: "11B", status: "Draft", avg: null, isPrivate: false, code: null },
    { id: 3, name: "Chemistry Lab", date: "May 02, 2025", class: "10B", status: "Graded", avg: 82, isPrivate: true, code: "CHM-4B1" },
  ]);

  const [students, setStudents] = useState([
    { id: 1, name: "Sarah Johnson", email: "sarah.j@student.edu", class: "10A", score: 94, status: "Excellent" },
    { id: 2, name: "Michael Chen", email: "m.chen@student.edu", class: "11B", score: 87, status: "Good" },
    { id: 3, name: "Emma Williams", email: "emma.w@student.edu", class: "10B", score: 72, status: "Needs Help" },
  ]);

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()));

  const getSearchSuggestions = () => {
      if (!searchQuery) return [];
      const q = searchQuery.toLowerCase();
      const st = students.filter(s => s.name.toLowerCase().includes(q)).map(s => ({ type: 'Student', text: s.name, action: () => setActiveTab('students') }));
      const ts = tests.filter(t => t.name.toLowerCase().includes(q)).map(t => ({ type: 'Test', text: t.name, action: () => setActiveTab('tests') }));
      const pages = ['analytics', 'dashboard', 'ai-tools'].filter(p => p.includes(q)).map(p => ({ type: 'Page', text: p.toUpperCase(), action: () => setActiveTab(p) }));
      return [...st, ...ts, ...pages].slice(0, 5);
  };
  const searchSuggestions = getSearchSuggestions();

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSent(true);
    setTimeout(() => { setInviteSent(false); setShowInviteModal(false); setInviteEmail(""); }, 2000);
  };

  const removeStudent = (id: number) => setStudents(students.filter(s => s.id !== id));
  const getFirstName = () => profile?.full_name?.split(' ')[0] || "Educator";

  return (
    <div className={`${isDarkMode ? "dark" : ""}`}>
      {/* BACKGROUND: Soft slate-100 grey for pages and side buttons base */}
      <div className="flex h-screen w-full font-sans text-slate-800 dark:text-slate-100 overflow-hidden relative transition-colors duration-500 bg-slate-100 dark:bg-slate-900">
        <style>{customStyles}</style>

        {/* Ambient Sky Blue / Deep Blue Lights */}
        <div className="absolute top-0 left-0 w-full h-[70vh] bg-gradient-to-b from-sky-200/90 via-blue-100/40 to-transparent dark:from-blue-900/60 dark:via-blue-900/20 pointer-events-none z-0"></div>
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[60rem] h-[30rem] bg-sky-300/40 dark:bg-blue-800/40 rounded-full filter blur-[100px] pointer-events-none z-0"></div>

        {mobileMenuOpen && <div className="fixed inset-0 bg-white/20 dark:bg-black/60 backdrop-blur-md z-[190] lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

        {/* ================= SIDEBAR ================= */}
        <aside className={`fixed lg:relative top-0 left-0 w-[300px] h-full flex flex-col bg-slate-50 dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800 z-[200] lg:z-50 shrink-0 transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-8 pb-4">
            <div className="flex items-center justify-between mb-10 animate-entrance" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center gap-3">
                <img src="/ICON.ico" alt="Logo" className="w-8 h-8 object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                <div className="hidden w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-sm shadow-md">A</div>
                <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white drop-shadow-sm">a4ai</span>
              </div>
              <button className="lg:hidden text-slate-500 bg-white/50 p-2 rounded-full" onClick={() => setMobileMenuOpen(false)}><Icons.X /></button>
            </div>

            {/* Nav Wrapper Container - Matches screenshot grey background style */}
            <div className="bg-slate-100/80 dark:bg-slate-800/40 p-3 rounded-[40px] shadow-inner border border-white/60 dark:border-white/5 animate-entrance" style={{ animationDelay: '200ms' }}>
              <nav className="space-y-2">
                <SidebarButton active={activeTab === 'dashboard'} icon={Icons.Grid} label="Dashboard" onClick={() => {setActiveTab('dashboard'); setMobileMenuOpen(false);}} />
                <SidebarButton active={activeTab === 'students'} icon={Icons.Users} label="Students" onClick={() => {setActiveTab('students'); setMobileMenuOpen(false);}} />
                <SidebarButton active={activeTab === 'tests'} icon={Icons.History} label="Test History" onClick={() => {setActiveTab('tests'); setMobileMenuOpen(false);}} />
                <SidebarButton active={activeTab === 'analytics'} icon={Icons.Chart} label="Analytics" onClick={() => {setActiveTab('analytics'); setMobileMenuOpen(false);}} />
                <SidebarButton active={activeTab === 'ai-tools'} icon={Icons.Brain} label="AI Tools" onClick={() => {setActiveTab('ai-tools'); setMobileMenuOpen(false);}} />
              </nav>
            </div>
          </div>

          <div className="mt-auto p-8 pt-4 animate-entrance" style={{ animationDelay: '300ms' }}>
            {/* Pro Plan Box - Enclosed in separate grey bg */}
            <div className="bg-slate-100/80 dark:bg-slate-800/40 p-6 text-center rounded-[40px] shadow-inner border border-white/60 dark:border-white/5 transform transition-transform active:scale-95 duration-200">
              <div className="mb-4 flex justify-center">
                  <div className="rounded-[24px] bg-white dark:bg-slate-700 shadow-sm p-4 text-blue-600 dark:text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"><Icons.Zap /></div>
              </div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-1 text-base">Pro Plan</h4>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">Unlock advanced analysis</p>
              <GlossyButton label="Upgrade" variant="blue" small fullWidth onClick={() => navigate('/dashboard/subscription')} />
            </div>
          </div>
        </aside>

        {/* ================= MAIN CONTENT ================= */}
        <main onScroll={handleMainScroll} className="flex-1 h-full overflow-y-auto relative z-10 scroll-smooth pb-32">
          
          {/* ================= APPLE-STYLE STICKY SEARCH BAR ================= */}
          <div ref={stickySearchRef} className={`fixed top-6 left-1/2 z-[300] apple-spring pointer-events-auto ${isScrolled ? '-translate-x-1/2 w-[90%] sm:w-[60%] max-w-3xl opacity-100 visible translate-y-0 scale-100' : '-translate-x-1/2 w-[40%] max-w-md opacity-0 invisible -translate-y-12 scale-75'}`}>
              <div className="flex items-center glass-overlay shadow-[0_20px_40px_rgba(0,0,0,0.1)] rounded-full p-2.5 h-16 border border-white/80 dark:border-slate-700/80 backdrop-blur-2xl bg-white/70 dark:bg-slate-900/70">
                  <div className="pl-5 pr-2 text-slate-400 scale-110"><Icons.Search /></div>
                  <input 
                      type="text" 
                      placeholder="Search students, tests, or AI tools..." 
                      className="flex-1 w-full bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white px-2 placeholder-slate-400"
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {setIsSearchOpen(true); setShowSearchSuggestions(true);}}
                  />
                  <button className="w-12 h-12 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform shrink-0 border border-white/20">
                      <Icons.Search />
                  </button>
              </div>

              {showSearchSuggestions && searchQuery && isScrolled && (
                  <div className="absolute top-full mt-4 w-full glass-overlay rounded-[32px] overflow-hidden animate-pop shadow-2xl border border-white/60 dark:border-slate-700/80">
                      <div className="p-4 text-xs font-bold text-sky-500 uppercase tracking-wider bg-white/40 dark:bg-black/20 border-b border-white/50">Suggestions</div>
                      {searchSuggestions.length > 0 ? (
                          searchSuggestions.map((item, idx) => (
                              <button key={idx} onClick={() => { item.action(); setShowSearchSuggestions(false); setIsSearchOpen(false); setSearchQuery(""); }} className="w-full text-left px-5 py-4 hover:bg-black/5 flex items-center justify-between text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors">
                                  <span className="flex items-center gap-3"><div className="text-sky-500"><Icons.Search /></div> {item.text}</span>
                                  <span className="text-[10px] inset-pill px-3 py-1 rounded-full text-blue-600 font-bold">{item.type}</span>
                              </button>
                          ))
                      ) : (
                          <div className="p-4 text-sm font-bold text-slate-500 text-center">No results found</div>
                      )}
                  </div>
              )}
          </div>
          {/* ================================================================= */}


          <div className="p-4 lg:p-10 max-w-[1400px] mx-auto relative">
            
            {/* Header */}
            <header className="relative z-[100] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 animate-entrance" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center gap-5">
                <button className="lg:hidden p-3 text-blue-600 glass-panel rounded-[24px]" onClick={() => setMobileMenuOpen(true)}>
                    <Icons.Menu />
                </button>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
                      {activeTab === 'profile' ? 'Your Profile' : `Welcome, Professor ${getFirstName()}`}
                  </h1>
                  <p className="text-slate-600 dark:text-blue-200/70 text-base mt-2 font-medium">
                      {activeTab === 'profile' ? 'Manage your account settings and preferences.' : "Here's what's happening in your classes today."}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 sm:gap-6 w-full sm:w-auto pl-1 h-14">
                 {/* INSET PILL SEARCH BAR (Original - Fades out on scroll) */}
                 <div className={`relative group shrink-1 transition-all duration-500 apple-spring origin-right ${isScrolled ? 'w-0 opacity-0 pointer-events-none scale-50' : 'w-full max-w-[250px] sm:max-w-none opacity-100 scale-100'}`} ref={searchRef}>
                    <div className={`flex items-center inset-pill rounded-full p-1.5 transition-all duration-300 ${isSearchOpen || searchQuery ? 'w-full sm:w-72 border-sky-400/50' : 'w-40 sm:w-60 hover:border-sky-400/30'}`}>
                        <div className="pl-3 sm:pl-4 text-sky-500"><Icons.Search /></div>
                        <input 
                          type="text" 
                          placeholder="Search..." 
                          className="flex-1 w-full bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-white px-2 sm:px-3 placeholder-slate-400"
                          value={searchQuery} 
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => {setIsSearchOpen(true); setShowSearchSuggestions(true);}}
                        />
                        <button className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_4px_10px_rgba(59,130,246,0.3)] hover:scale-105 transition-transform shrink-0 border border-white/20">
                            <Icons.Search />
                        </button>
                    </div>

                    {showSearchSuggestions && !isScrolled && (
                        <div className="absolute top-full right-0 mt-4 w-64 sm:w-80 glass-overlay rounded-[32px] overflow-hidden animate-pop z-[150]">
                            <div className="p-4 text-xs font-bold text-sky-500 uppercase tracking-wider bg-white/40 dark:bg-black/20 border-b border-white/50">Suggestions</div>
                            {searchQuery && searchSuggestions.length > 0 ? (
                                searchSuggestions.map((item, idx) => (
                                    <button key={idx} onClick={() => { item.action(); setShowSearchSuggestions(false); setIsSearchOpen(false); setSearchQuery(""); }} className="w-full text-left px-5 py-4 hover:bg-black/5 flex items-center justify-between text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors">
                                        <span className="flex items-center gap-3"><div className="text-sky-500"><Icons.Search /></div> {item.text}</span>
                                        <span className="text-[10px] inset-pill px-3 py-1 rounded-full text-blue-600 font-bold">{item.type}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="p-4">
                                    <button onClick={() => { setActiveTab('students'); setShowSearchSuggestions(false); setIsSearchOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-black/5 rounded-[24px] flex items-center gap-3 text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors"><Icons.Users /> Manage Students</button>
                                </div>
                            )}
                        </div>
                    )}
                 </div>
                 
                 {/* NOTIFICATIONS */}
                 <div className="relative shrink-0 transition-transform apple-spring" ref={notifRef}>
                     <button onClick={() => setIsNotifOpen(!isNotifOpen)} className={`p-3 sm:p-3.5 rounded-[24px] inset-pill transition-all relative active:scale-95 hover:shadow-[0_0_15px_rgba(255,255,255,0.8)] ${isNotifOpen ? 'text-blue-600 border-blue-300' : 'text-slate-500 dark:text-slate-300'}`}>
                        <Icons.Bell />
                        <span className="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 w-2.5 sm:w-3 h-2.5 sm:h-3 bg-gradient-to-tr from-sky-400 to-blue-600 rounded-full border-2 border-white shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                     </button>
                     
                     {isNotifOpen && (
                         <div className="absolute right-0 top-full mt-4 w-80 glass-overlay rounded-[40px] p-5 flex flex-col gap-2 animate-pop z-[150]">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Notifications</h3>
                                <span className="text-[10px] font-bold btn-glossy-blue px-3 py-1 rounded-full uppercase tracking-wider">3 New</span>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-4 items-start p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[28px] transition-colors cursor-pointer inset-pill border-none group">
                                    <div className="text-blue-500 group-hover:scale-110 transition-transform"><Icons.Users /></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">New Student Joined</p>
                                        <p className="text-xs text-slate-500 font-medium mt-1">Emma Williams enrolled in 10B.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start p-4 hover:bg-black/5 dark:hover:bg-white/10 rounded-[28px] transition-colors cursor-pointer inset-pill border-none group">
                                    <div className="text-blue-500 group-hover:scale-110 transition-transform"><Icons.Check /></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Test Auto-Graded</p>
                                        <p className="text-xs text-slate-500 font-medium mt-1">Physics Midterm grading complete.</p>
                                    </div>
                                </div>
                            </div>
                            <button className="text-xs font-bold text-slate-500 hover:text-blue-600 w-full text-center mt-3 py-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-[28px] transition-colors">Mark all as read</button>
                         </div>
                     )}
                 </div>
                 
                 {/* PROFILE DROPDOWN */}
                 <div className="relative shrink-0 transition-transform apple-spring" ref={profileRef}>
                    <div onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 sm:gap-4 pl-3 sm:pl-6 border-l border-slate-300/50 dark:border-slate-600/50 cursor-pointer group">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors drop-shadow-sm">{profile.full_name}</p>
                            <p className="text-xs text-slate-500 font-medium">Senior Educator</p>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[24px] inset-pill flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.8)] transition-all">
                            <Icons.GradCap />
                        </div>
                    </div>

                    {isProfileOpen && (
                        <div className="absolute right-0 top-full mt-4 w-72 glass-overlay rounded-[40px] p-3 flex flex-col gap-2 animate-pop z-[150]">
                            <div className="px-5 py-4 mb-2 inset-pill rounded-[32px] border-none">
                                <p className="font-extrabold text-slate-800 dark:text-white text-lg">{profile.full_name}</p>
                                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1 drop-shadow-sm"><Icons.Zap /> {profile.coins} Coins</p>
                            </div>
                            
                            <button onClick={() => { setActiveTab('profile'); setIsProfileOpen(false); }} className="flex items-center gap-3 px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[28px] transition-colors">
                                <Icons.User /> Profile Dashboard
                            </button>

                            <button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[28px] transition-colors">
                                <div className="flex items-center gap-3"><Icons.Moon /> Dark Mode</div>
                                <div className={`w-12 h-6 rounded-full transition-colors shadow-inner ${isDarkMode ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'} relative flex items-center px-1`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.3)] transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </div>
                            </button>
                            
                            <button onClick={(e) => { 
                                e.stopPropagation(); 
                                setLanguage(l => l === "EN" ? "ES" : l === "ES" ? "HI" : "EN"); 
                            }} className="flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-[28px] transition-colors">
                                <div className="flex items-center gap-3"><Icons.Globe /> Language</div>
                                <div className="text-xs font-bold inset-pill px-3 py-1 rounded-full text-blue-600 dark:text-blue-400">{language}</div>
                            </button>
                            
                            <div className="h-px bg-slate-200/50 dark:bg-slate-700/50 my-2 mx-4" />
                            <button onClick={() => navigate('/login')} className="flex items-center gap-3 px-5 py-4 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-[28px] transition-colors"><Icons.LogOut /> Logout</button>
                        </div>
                    )}
                 </div>
              </div>
            </header>

            {/* DYNAMIC CONTENT AREA */}
            <div className="space-y-10 relative z-10">
                
                {/* --- DASHBOARD TAB --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-entrance">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            
                            {/* Hero Banner */}
                            <div className="xl:col-span-2 glass-panel rounded-[48px] p-10 sm:p-14 relative overflow-hidden flex flex-col justify-center hover:shadow-[0_20px_50px_rgba(59,130,246,0.05)] transition-all duration-500 group">
                                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/60 to-transparent pointer-events-none rounded-[48px]"></div>
                                <div className="relative z-10 max-w-xl">
                                    <div className="flex items-center gap-2 mb-6 bg-white/50 dark:bg-slate-800/50 border border-white/80 w-fit px-5 py-2 rounded-[24px] shadow-sm">
                                        <div className="text-blue-500 drop-shadow-md"><Icons.Brain /></div>
                                        <span className="text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">AI Assistant Active</span>
                                    </div>
                                    <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-[1.1] drop-shadow-sm">
                                        Enhance learning with AI tools.
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg mb-10 font-medium">
                                        Monitor progress, generate dynamic tests, and get real-time insights for your students instantly.
                                    </p>
                                    <div className="flex gap-4">
                                        <GlossyButton label="Create AI Test" variant="blue" icon={Icons.Zap} onClick={() => navigate('/dashboard/test-generator')} />
                                    </div>
                                </div>
                                <div className="absolute right-[-5%] bottom-[-10%] opacity-[0.03] dark:opacity-10 pointer-events-none scale-[2] text-blue-900 dark:text-white group-hover:scale-[2.1] transition-transform duration-700">
                                    <Icons.Brain />
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="xl:col-span-1 glass-panel rounded-[48px] p-10 flex flex-col hover:shadow-[0_20px_50px_rgba(59,130,246,0.05)] transition-all">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 inset-pill border-none flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner rounded-[32px]">
                                        <Icons.Trophy />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white drop-shadow-sm">Quick Actions</h3>
                                </div>
                                <div className="space-y-5">
                                    <GlossyButton label="New Test" subLabel="AI Powered Generator" variant="light" icon={Icons.Plus} fullWidth onClick={() => navigate('/dashboard/test-generator')} />
                                    <GlossyButton label="Host Contest" subLabel="Start Live Competition" variant="light" icon={Icons.Trophy} fullWidth onClick={() => navigate('/contests')} />
                                    <GlossyButton label="Analytics" subLabel="View Student Reports" variant="light" icon={Icons.Chart} fullWidth onClick={() => setActiveTab('analytics')} />
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-8">
                            {[{t:"Active Students", v:"156", c:"+12%", i:Icons.Users}, {t:"Tests Created", v:"24", c:"+5", i:Icons.FileText}, {t:"Engagement", v:"92%", c:"+3.2%", i:Icons.Chart}, {t:"Time Saved", v:"8h", c:"AI Tools", i:Icons.Clock}].map((stat, i) => (
                                <div key={i} className="glass-panel rounded-[40px] p-8 flex flex-col items-center text-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.05)] transition-all duration-300">
                                    <div className="text-blue-500 mb-5 inset-pill p-4 rounded-[24px] drop-shadow-md border-none"><stat.i /></div>
                                    <h3 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-2 drop-shadow-sm">{stat.v}</h3>
                                    <p className="text-[11px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest mb-4">{stat.t}</p>
                                    <span className="text-xs text-blue-600 dark:text-blue-300 font-extrabold bg-blue-100 dark:bg-blue-900/40 px-4 py-1.5 rounded-[20px] border border-blue-200 dark:border-blue-700/50 shadow-sm">{stat.c}</span>
                                </div>
                            ))}
                        </div>

                        {/* Recent Tests Table */}
                        <div className="glass-panel rounded-[48px] p-8 sm:p-12">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="font-black text-slate-900 dark:text-white text-3xl drop-shadow-sm">Recent Tests</h3>
                                <button onClick={() => setActiveTab('tests')} className="inset-pill text-blue-600 dark:text-blue-300 px-6 py-3 rounded-[24px] font-bold text-xs hover:bg-white/80 dark:hover:bg-white/10 transition-colors shadow-sm active:scale-95 border-none">View All</button>
                            </div>
                            <div className="space-y-4">
                                {tests.slice(0, 3).map(test => (
                                    <div key={test.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-[32px] bg-white/40 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/60 hover:shadow-lg transition-all duration-300 cursor-pointer group">
                                        <div className="flex items-center gap-5 mb-4 sm:mb-0">
                                            <div className="p-4 rounded-[24px] inset-pill border-none text-blue-500 shadow-inner group-hover:scale-110 transition-transform">
                                                <Icons.FileText />
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-slate-900 dark:text-white text-xl group-hover:text-blue-600 transition-colors">{test.name}</h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Class {test.class} • {test.date}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            {test.avg && <span className="text-sm font-bold text-blue-700 dark:text-blue-300 inset-pill border-none px-4 py-2 rounded-[20px] shadow-sm">Avg: {test.avg}%</span>}
                                            <div className="flex gap-2">
                                                <button className="text-slate-400 hover:text-blue-600 transition-colors p-3 inset-pill border-none rounded-[20px] shadow-sm hover:scale-110"><Icons.Eye /></button>
                                                <button className="text-slate-400 hover:text-blue-600 transition-colors p-3 inset-pill border-none rounded-[20px] shadow-sm hover:scale-110"><Icons.Dots /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- STUDENTS TAB --- */}
                {activeTab === 'students' && (
                    <div className="space-y-8 animate-pop">
                        <div className="glass-panel rounded-[48px] p-8 sm:p-12">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                                <h2 className="text-4xl font-black text-slate-900 dark:text-white drop-shadow-sm">Student Management</h2>
                                <GlossyButton label="Invite Student" variant="blue" icon={Icons.Plus} onClick={() => setShowInviteModal(true)} />
                            </div>
                            
                            <div className="relative mb-8">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-500"><Icons.Search /></div>
                                <input type="text" placeholder="Search by name or email..." className="w-full pl-16 pr-6 py-5 text-sm inset-pill rounded-[32px] focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-colors text-slate-800 dark:text-white placeholder-slate-400 font-bold" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                            </div>

                            <div className="overflow-x-auto rounded-[40px] border border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/20 backdrop-blur-md">
                                <table className="w-full text-left border-collapse">
                                    <thead className="text-xs text-slate-500 dark:text-slate-300 bg-white/60 dark:bg-slate-800/40 uppercase tracking-widest font-black border-b border-white/60 dark:border-slate-700/50">
                                        <tr><th className="py-6 pl-10">Student Profile</th><th className="py-6">Class</th><th className="py-6">Avg Score</th><th className="py-6">Status</th><th className="py-6 text-right pr-10">Action</th></tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {filteredStudents.map(s => (
                                            <tr key={s.id} className="border-b border-white/40 dark:border-slate-700/30 hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                                <td className="py-5 pl-10">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-14 h-14 rounded-[24px] inset-pill border-none flex items-center justify-center font-black text-blue-600 dark:text-blue-400 text-xl group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all">{s.name.charAt(0)}</div>
                                                        <div>
                                                            <p className="font-extrabold text-slate-900 dark:text-white text-lg group-hover:text-blue-600 transition-colors">{s.name}</p>
                                                            <p className="text-xs text-slate-500 mt-1 font-medium">{s.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 font-bold text-slate-500 dark:text-slate-300">{s.class}</td>
                                                <td className="py-5 font-black text-slate-900 dark:text-white text-xl">{s.score}%</td>
                                                <td className="py-5">
                                                    <span className={`text-[11px] px-4 py-2 rounded-[20px] font-bold uppercase tracking-wider shadow-sm border ${s.status === 'Excellent' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300' : s.status === 'Good' ? 'bg-white/60 text-slate-700 border-white/80 dark:bg-slate-800/40 dark:text-slate-300' : 'bg-white/40 text-slate-500 border-white/50 dark:bg-slate-900/40 dark:text-slate-400'}`}>{s.status}</span>
                                                </td>
                                                <td className="py-5 text-right pr-10">
                                                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="text-xs text-blue-600 dark:text-blue-300 font-bold inset-pill border-none px-5 py-3 rounded-[20px] hover:text-blue-800 hover:scale-105 transition-all shadow-sm">Profile</button>
                                                        <button onClick={(e) => {e.stopPropagation(); removeStudent(s.id);}} className="p-3 text-slate-400 hover:text-red-500 inset-pill border-none rounded-[20px] hover:scale-105 transition-all shadow-sm" title="Remove"><Icons.Trash /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredStudents.length === 0 && (
                                            <tr><td colSpan={5} className="py-16 text-center text-slate-500 font-medium text-lg">No students found matching your search.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TEST HISTORY TAB --- */}
                {activeTab === 'tests' && (
                    <div className="space-y-8 animate-pop">
                        <div className="glass-panel rounded-[48px] p-8 sm:p-12">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                                <h2 className="text-4xl font-black text-slate-900 dark:text-white drop-shadow-sm">Test History</h2>
                                <GlossyButton label="Create Test" variant="blue" icon={Icons.Zap} onClick={() => setShowTestModal(true)} />
                            </div>
                            
                            {tests.length === 0 ? (
                                <div className="py-32 text-center flex flex-col items-center inset-pill rounded-[48px] border-none">
                                    <div className="w-28 h-28 glass-panel rounded-full flex items-center justify-center text-blue-500 mb-8 shadow-inner"><Icons.FileText /></div>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">No Tests Created Yet</h3>
                                    <p className="text-slate-500 font-medium mb-10 max-w-md mx-auto text-lg">Generate your first AI-powered test and share the access code with your students.</p>
                                    <GlossyButton label="Create Test" variant="blue" icon={Icons.Zap} onClick={() => setShowTestModal(true)} />
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-[40px] border border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/20 backdrop-blur-md">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="text-xs text-slate-500 dark:text-slate-300 bg-white/60 dark:bg-slate-800/40 uppercase tracking-widest font-black border-b border-white/60 dark:border-slate-700/50">
                                            <tr><th className="py-6 pl-10">Test Name</th><th className="py-6">Access Code</th><th className="py-6 text-right pr-10">Action</th></tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {tests.map(t => (
                                                <tr key={t.id} className="border-b border-white/40 dark:border-slate-700/30 hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors group">
                                                    <td className="py-6 pl-10">
                                                        <p className="font-extrabold text-slate-900 dark:text-white text-lg group-hover:text-blue-600 transition-colors">{t.name}</p>
                                                        <p className="text-sm text-slate-500 mt-1 font-medium">Class {t.class} • {t.date}</p>
                                                    </td>
                                                    <td className="py-6">
                                                        {t.isPrivate ? (
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-mono text-base font-bold text-blue-700 dark:text-blue-200 inset-pill px-4 py-2 rounded-[20px] shadow-inner tracking-widest border-none">{t.code}</span>
                                                                <button className="text-slate-400 hover:text-blue-600 inset-pill border-none p-3 rounded-[20px] shadow-sm hover:scale-110 transition-transform"><Icons.Copy /></button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-base font-medium">Public</span>
                                                        )}
                                                    </td>
                                                    <td className="py-6 text-right pr-10">
                                                        <button className="text-sm text-blue-600 dark:text-blue-300 font-bold inset-pill border-none shadow-sm px-6 py-3 rounded-[24px] hover:text-blue-800 hover:scale-105 active:scale-95 transition-all opacity-0 group-hover:opacity-100">View Results</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- REAL ANALYTICS TAB --- */}
                {activeTab === 'analytics' && (
                    <div className="space-y-8 animate-pop">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 glass-panel rounded-[48px] p-10 min-h-[500px] flex flex-col justify-center items-center text-center">
                                <div className="w-24 h-24 inset-pill border-none text-blue-500 rounded-full flex items-center justify-center mb-8 shadow-inner"><Icons.Chart /></div>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4 drop-shadow-sm">Class Performance Trends</h3>
                                <p className="text-slate-500 font-medium max-w-sm text-lg">Detailed visual graphs will render here after 5 tests are completed.</p>
                            </div>
                            <div className="glass-panel rounded-[48px] p-10 flex flex-col gap-8">
                                <h3 className="font-black text-slate-900 dark:text-white text-2xl drop-shadow-sm">Top Performers</h3>
                                <div className="space-y-5">
                                    {[1,2,3].map((i, idx) => (
                                        <div key={i} className="flex items-center gap-5 inset-pill border-none p-5 rounded-[32px] shadow-sm hover:scale-105 transition-transform">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center font-black text-xl shadow-[0_4px_10px_rgba(59,130,246,0.3)] border border-white/20">{idx+1}</div>
                                            <div className="flex-1">
                                                <p className="font-extrabold text-slate-900 dark:text-white text-lg">{students[idx]?.name || "Student"}</p>
                                                <div className="h-3 bg-white/60 dark:bg-slate-800/50 rounded-full mt-2 w-full overflow-hidden shadow-inner">
                                                    <div className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full" style={{width: `${90 - (idx*10)}%`}}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- AI TOOLS EXPANDED TAB --- */}
                {activeTab === 'ai-tools' && (
                    <div className="space-y-8 animate-pop">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 glass-panel rounded-[40px] p-8">
                            <div>
                                <h2 className="text-4xl font-black text-slate-900 dark:text-white drop-shadow-sm">AI Utilities</h2>
                                <p className="text-base text-slate-500 font-medium mt-2">Supercharge your teaching workflow with smart tools.</p>
                            </div>
                        </div>

                        {/* Tools Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            <div className="glass-panel p-10 rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.1)] transition-all relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-20 h-20 inset-pill border-none text-blue-600 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner"><Icons.Brain /></div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 drop-shadow-sm">Test Generator</h3>
                                <p className="text-base text-slate-500 mb-8 font-medium">Create multiple-choice tests in seconds based on any topic.</p>
                                <GlossyButton label="Create Test" variant="blue" fullWidth small onClick={() => navigate('/dashboard/test-generator')} />
                            </div>

                            <div className="glass-panel p-10 rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.05)] transition-all">
                                <div className="w-20 h-20 inset-pill border-none text-blue-500 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner"><Icons.FileText /></div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 drop-shadow-sm">Auto-Grade</h3>
                                <p className="text-base text-slate-500 mb-8 font-medium">Use AI to analyze long-form answers and essays instantly.</p>
                                <GlossyButton label="Launch Tool" variant="light" fullWidth small />
                            </div>

                            <div className="glass-panel p-10 rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.05)] transition-all">
                                <div className="w-20 h-20 inset-pill border-none text-sky-500 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner"><Icons.Book /></div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 drop-shadow-sm">Study Guides</h3>
                                <p className="text-base text-slate-500 mb-8 font-medium">Convert raw curriculum notes into smart flashcards.</p>
                                <GlossyButton label="Launch Tool" variant="light" fullWidth small />
                            </div>

                            <div className="glass-panel p-10 rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.05)] transition-all">
                                <div className="w-20 h-20 inset-pill border-none text-blue-500 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner"><Icons.Search /></div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 drop-shadow-sm">Plagiarism Check</h3>
                                <p className="text-base text-slate-500 mb-8 font-medium">Scan submissions against the web and AI datasets.</p>
                                <GlossyButton label="Launch Tool" variant="light" fullWidth small />
                            </div>

                            <div className="glass-panel p-10 rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.05)] transition-all">
                                <div className="w-20 h-20 inset-pill border-none text-blue-500 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner"><Icons.Grid /></div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 drop-shadow-sm">Smart Rubrics</h3>
                                <p className="text-base text-slate-500 mb-8 font-medium">Generate fair, standard-aligned grading rubrics.</p>
                                <GlossyButton label="Launch Tool" variant="light" fullWidth small />
                            </div>

                            <div className="glass-panel p-10 rounded-[48px] flex flex-col justify-center text-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.05)] transition-all">
                                <div className="w-20 h-20 inset-pill border-none text-blue-500 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner"><Icons.Clock /></div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 drop-shadow-sm">Lesson Planner</h3>
                                <p className="text-base text-slate-500 mb-8 font-medium">Outline comprehensive lesson plans by pacing & standard.</p>
                                <GlossyButton label="Launch Tool" variant="light" fullWidth small />
                            </div>
                        </div>

                        {/* Recent AI Generations History */}
                        <div className="glass-panel rounded-[48px] p-10 mt-10">
                            <h3 className="font-black text-slate-900 dark:text-white text-3xl mb-8 drop-shadow-sm">Recent Generations</h3>
                            <div className="overflow-x-auto rounded-[40px] border border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/20 backdrop-blur-md">
                                <table className="w-full text-left border-collapse">
                                    <thead className="text-xs text-slate-500 uppercase tracking-widest font-black border-b border-white/60 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40">
                                        <tr><th className="p-6 pl-10">Tool Used</th><th className="p-6">Output Subject</th><th className="p-6">Date</th><th className="p-6 text-right pr-10">Action</th></tr>
                                    </thead>
                                    <tbody className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        <tr className="border-b border-white/40 dark:border-slate-700/30 hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-6 pl-10 flex items-center gap-4"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div> Test Generator</td>
                                            <td className="p-6">Quantum Mechanics Quiz</td>
                                            <td className="p-6 text-slate-500">Today, 2:30 PM</td>
                                            <td className="p-6 text-right pr-10"><button className="text-blue-600 inset-pill border-none px-4 py-2 rounded-[20px] hover:scale-105 transition-transform shadow-sm">View</button></td>
                                        </tr>
                                        <tr className="border-b border-white/40 dark:border-slate-700/30 hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-6 pl-10 flex items-center gap-4"><div className="w-3 h-3 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]"></div> Auto-Grade</td>
                                            <td className="p-6">Midterm Essay: 11B</td>
                                            <td className="p-6 text-slate-500">Yesterday</td>
                                            <td className="p-6 text-right pr-10"><button className="text-blue-600 inset-pill border-none px-4 py-2 rounded-[20px] hover:scale-105 transition-transform shadow-sm">View</button></td>
                                        </tr>
                                        <tr className="hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-6 pl-10 flex items-center gap-4"><div className="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]"></div> Lesson Planner</td>
                                            <td className="p-6">Intro to Calculus (Week 1)</td>
                                            <td className="p-6 text-slate-500">Mar 15, 2025</td>
                                            <td className="p-6 text-right pr-10"><button className="text-blue-600 inset-pill border-none px-4 py-2 rounded-[20px] hover:scale-105 transition-transform shadow-sm">View</button></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PROFILE TAB --- */}
                {activeTab === 'profile' && (
                    <div className="space-y-8 animate-pop max-w-4xl mx-auto">
                        <div className="glass-panel rounded-[48px] p-10 sm:p-14 relative overflow-hidden group">
                            {/* Decorative Background Light inside profile */}
                            <div className="absolute top-0 right-0 w-80 h-80 bg-sky-300/30 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 group-hover:bg-sky-300/50 transition-colors duration-700"></div>

                            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-10">
                                <div className="w-36 h-36 rounded-[40px] inset-pill border-none flex items-center justify-center text-blue-600 font-bold shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                                    <div className="scale-[1.5]"><Icons.GradCap /></div>
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 drop-shadow-sm">{profile.full_name}</h2>
                                    <p className="text-xl text-slate-500 font-medium mb-8">Senior Educator • Mathematics Department</p>
                                    
                                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                        <span className="px-5 py-3 inset-pill border-none text-slate-800 dark:text-slate-200 rounded-[24px] font-bold text-sm flex items-center gap-3 shadow-sm"><Icons.Mail /> {profile.email}</span>
                                        <span className="px-5 py-3 bg-blue-100 text-blue-700 border border-blue-200/50 rounded-[24px] font-bold text-sm flex items-center gap-3 shadow-sm dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50"><Icons.Zap /> {profile.coins} AI Coins</span>
                                    </div>
                                </div>
                                <div className="shrink-0 mt-6 md:mt-0">
                                    <GlossyButton label="Edit Profile" variant="light" small icon={Icons.Settings} />
                                </div>
                            </div>
                            
                            <hr className="my-12 border-white/50 dark:border-slate-700/50" />
                            
                            <h3 className="font-black text-slate-900 dark:text-white text-2xl mb-8 drop-shadow-sm">Account Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">School / Institute</label>
                                    <div className="w-full px-6 py-5 rounded-[32px] inset-pill border-none text-slate-800 dark:text-slate-200 font-bold text-lg shadow-sm">Lincoln High School</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Account Type</label>
                                    <div className="w-full px-6 py-5 rounded-[32px] inset-pill border-none text-slate-800 dark:text-slate-200 font-bold text-lg shadow-sm flex justify-between items-center">
                                        Pro Plan (Active) <span className="text-blue-600 drop-shadow-md"><Icons.Check /></span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Classes Taught</label>
                                    <div className="w-full px-6 py-5 rounded-[32px] inset-pill border-none text-slate-800 dark:text-slate-200 font-bold text-lg shadow-sm">10A, 10B, 11B</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Join Date</label>
                                    <div className="w-full px-6 py-5 rounded-[32px] inset-pill border-none text-slate-500 font-bold text-lg shadow-sm">August 12, 2024</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
          </div>
        </main>

        {/* ================= CIRCULAR CHATBOT BUTTON (Blue Gradient) z-[110] ================= */}
        <div className="fixed bottom-8 right-8 z-[110] flex flex-col items-end gap-5 animate-entrance" style={{ animationDelay: '500ms' }}>
            
            {isChatOpen && (
                <div className="w-80 sm:w-96 h-[450px] rounded-[48px] shadow-[0_30px_60px_rgba(59,130,246,0.15)] overflow-hidden flex flex-col animate-pop glass-overlay border border-white/60">
                    <div className="bg-gradient-to-r from-sky-400 to-blue-600 p-5 flex justify-between items-center text-white shrink-0 shadow-md relative z-10">
                        <span className="font-extrabold text-base flex items-center gap-3 drop-shadow-sm"><Icons.Brain /> a4ai Assistant</span>
                        <button className="cursor-pointer hover:scale-110 hover:bg-white/20 p-2 rounded-full transition-all" onClick={() => setIsChatOpen(false)}><Icons.X /></button>
                    </div>
                    
                    <div className="flex-1 p-5 overflow-y-auto space-y-4 relative bg-white/10 dark:bg-black/10">
                        <div className="p-4 rounded-[28px] rounded-tl-none max-w-[85%] text-sm font-bold bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white shadow-sm border border-white/80">
                            Hello! I am a4ai, your teaching assistant. How can I help you create tests or manage students today?
                        </div>
                        
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-4 rounded-[28px] max-w-[85%] text-sm font-bold shadow-sm ${
                                    msg.role === 'user' 
                                        ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-tr-none' 
                                        : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white rounded-tl-none border border-white/80'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        
                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="p-4 rounded-[28px] rounded-tl-none bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/80 flex items-center gap-3 text-blue-600 dark:text-blue-300">
                                    <Icons.Loader />
                                    <span className="text-xs font-black uppercase tracking-widest">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 shrink-0 glass-panel border-t-0 bg-white/40 dark:bg-black/20">
                        <div className="relative flex items-center">
                            <input 
                                type="text" 
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => { if(e.key === 'Enter') handleSendMessage(); }}
                                placeholder="Type a message..."
                                className="w-full text-sm font-bold p-4 pr-14 rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 text-slate-800 dark:text-white placeholder-slate-500 shadow-sm bg-white/80 dark:bg-slate-800/80" 
                            />
                            <button 
                                onClick={handleSendMessage}
                                disabled={isChatLoading || !inputMessage.trim()}
                                className="absolute right-2 p-2.5 bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-[24px] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                            >
                                <Icons.Send />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => setIsChatOpen(!isChatOpen)} className="w-20 h-20 btn-glossy-blue rounded-[32px] transition-all hover:-translate-y-2 active:scale-95 flex items-center justify-center z-[110]">
                {isChatOpen ? <div className="scale-125"><Icons.X /></div> : <div className="scale-125"><Icons.MessageCircle /></div>}
            </button>
        </div>

        {/* ================= MODALS z-[200] ================= */}
        
        {/* Invite Modal */}
        {showInviteModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-pop">
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={() => setShowInviteModal(false)}></div>
                <div className="glass-overlay p-10 sm:p-12 rounded-[56px] w-full max-w-md relative z-10 text-center shadow-[0_30px_60px_rgba(59,130,246,0.15)] border-white/80">
                    <button onClick={() => setShowInviteModal(false)} className="absolute top-8 right-8 p-3 text-slate-400 inset-pill border-none rounded-full transition-all hover:scale-110 hover:text-blue-600"><Icons.X /></button>
                    {!inviteSent ? (
                        <>
                            <div className="w-24 h-24 inset-pill border-none text-blue-600 rounded-[36px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <div className="scale-125"><Icons.Mail /></div>
                            </div>
                            <h3 className="text-4xl font-black mb-4 text-slate-900 dark:text-white drop-shadow-sm">Invite Student</h3>
                            <p className="text-base text-slate-500 mb-10 font-medium">Send an email invitation to add a student to your class roster.</p>
                            <form onSubmit={handleInvite} className="space-y-8 text-left">
                                <div className="relative">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-400"><Icons.Mail /></div>
                                    <input required type="email" placeholder="Email Address" className="w-full pl-16 pr-6 py-5 rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all font-bold text-slate-800 dark:text-white placeholder-slate-400 shadow-sm" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                                </div>
                                <GlossyButton label="Send Invitation" variant="blue" fullWidth />
                            </form>
                        </>
                    ) : (
                        <div className="py-10">
                            <div className="w-28 h-28 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 border border-blue-200/50 shadow-inner backdrop-blur-md dark:bg-blue-900/40 dark:border-blue-700/50">
                                <div className="scale-150"><Icons.Check /></div>
                            </div>
                            <h4 className="font-black text-3xl text-slate-900 dark:text-white mb-4 drop-shadow-sm">Invitation Sent!</h4>
                            <p className="text-slate-500 font-medium text-lg">They will appear in your list once they join.</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Create Test Modal */}
        {showTestModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-pop">
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={() => setShowTestModal(false)}></div>
                <div className="glass-overlay p-10 sm:p-12 rounded-[56px] w-full max-w-md relative z-10 text-center shadow-[0_30px_60px_rgba(59,130,246,0.15)] border-white/80">
                    <button onClick={() => setShowTestModal(false)} className="absolute top-8 right-8 p-3 text-slate-400 inset-pill border-none rounded-full transition-all hover:scale-110 hover:text-blue-600"><Icons.X /></button>
                    <div className="w-24 h-24 inset-pill border-none text-blue-600 rounded-[36px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <div className="scale-125"><Icons.Brain /></div>
                    </div>
                    <h3 className="text-4xl font-black mb-4 text-slate-900 dark:text-white drop-shadow-sm">Create AI Test</h3>
                    <p className="text-base text-slate-500 font-medium mb-10">Generate a new test instantly and configure access.</p>
                    
                    <div className="space-y-8 text-left">
                        <div className="relative">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-sky-400"><Icons.FileText /></div>
                            <input type="text" placeholder="Topic (e.g. Thermodynamics)" className="w-full pl-16 pr-6 py-5 rounded-[32px] inset-pill border-none focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all font-bold text-slate-800 dark:text-white placeholder-slate-400 shadow-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                            <button className="p-5 border border-blue-300 bg-blue-100 rounded-[32px] font-black text-blue-600 text-sm flex flex-col items-center justify-center gap-3 hover:scale-105 transition-transform shadow-sm dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300">
                                <div className="scale-125"><Icons.Key /></div> Private Code
                            </button>
                            <button className="p-5 inset-pill border-none rounded-[32px] font-black text-slate-500 dark:text-slate-300 text-sm flex flex-col items-center justify-center gap-3 hover:scale-105 hover:text-blue-600 transition-all shadow-sm">
                                <div className="scale-125"><Icons.Globe /></div> Public Link
                            </button>
                        </div>
                        <GlossyButton label="Generate Test" variant="blue" fullWidth onClick={() => {
                            navigate('/dashboard/test-generator');
                            setShowTestModal(false);
                        }} />
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
