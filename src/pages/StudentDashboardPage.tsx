// src/pages/StudentDashboardPage.tsx
import React, {
  useEffect,
  useState,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTheme } from "@/context/ThemeContext"; // Imported Theme Hook

const ScratchCard = lazy(() => import("@/components/ScratchCard"));

import {
  Bell,
  Search,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Rocket,
  BarChart3,
  Flame,
  BookOpen,
  Award,
  TrendingUp,
  MessageCircle, 
  User,
  Moon,
  Sun,
  Globe,
  X
} from "lucide-react";

/* ------------------- UTILS ------------------- */

const safeStorage = {
  get(key: string) {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    } catch { return null; }
  },
  set(key: string, value: string) {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    } catch { /* no-op */ }
  },
};

/* ------------------- TRANSLATIONS ------------------- */
const translations = {
  en: {
    dashboard: "Dashboard",
    notes: "Notes",
    inbox: "Inbox",
    students: "Students",
    settings: "Settings",
    getPremium: "Get Premium",
    unlockFeatures: "Unlock all features",
    upgradePlan: "Upgrade Plan",
    logOut: "Log out",
    welcome: "Welcome back",
    courseProgress: "Your average course progress is",
    levelUp: "Level up your learning to improve your student rank!",
    continueLearning: "Continue Learning",
    learningActivity: "Learning Activity",
    totalTime: "Total Time",
    courses: "Courses",
    rank: "Rank",
    quickActions: "Quick Actions",
    joinContests: "Join Contests",
    leaderboard: "Leaderboard",
    upcomingAssignments: "Upcoming Assignments",
    allTests: "All tests",
    testName: "Test name",
    deadline: "Deadline",
    status: "Status",
    profile: "Profile",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    language: "Language (Hindi)",
    extraTools: "Extra Tools",
    studyNotes: "Study Notes",
    performance: "Performance",
    upcomingClasses: "Upcoming Classes",
    portal: "Portal",
    searchPlaceholder: "Search...",
    notifications: "Notifications",
    noNotifications: "No new notifications",
    chatHello: "Hello! How can I help you with your studies today?",
    typeMessage: "Type a message..."
  },
  hi: {
    dashboard: "डैशबोर्ड",
    notes: "नोट्स",
    inbox: "इनबॉक्स",
    students: "छात्र",
    settings: "सेटिंग्स",
    getPremium: "प्रीमियम लें",
    unlockFeatures: "सभी सुविधाएँ अनलॉक करें",
    upgradePlan: "प्लान अपग्रेड करें",
    logOut: "लॉग आउट",
    welcome: "वापसी पर स्वागत है",
    courseProgress: "आपकी औसत पाठ्यक्रम प्रगति है",
    levelUp: "अपनी रैंक सुधारने के लिए पढ़ाई का स्तर बढ़ाएं!",
    continueLearning: "पढ़ना जारी रखें",
    learningActivity: "सीखने की गतिविधि",
    totalTime: "कुल समय",
    courses: "पाठ्यक्रम",
    rank: "रैंक",
    quickActions: "त्वरित कार्य",
    joinContests: "प्रतियोगिताओं में शामिल हों",
    leaderboard: "लीडरबोर्ड",
    upcomingAssignments: "आगामी कार्य",
    allTests: "सभी परीक्षण",
    testName: "परीक्षण का नाम",
    deadline: "समय सीमा",
    status: "स्थिति",
    profile: "प्रोफाइल",
    darkMode: "डार्क मोड",
    lightMode: "लाइट मोड",
    language: "भाषा (English)",
    extraTools: "अतिरिक्त उपकरण",
    studyNotes: "अध्ययन नोट्स",
    performance: "प्रदर्शन",
    upcomingClasses: "आगामी कक्षाएं",
    portal: "पोर्टल",
    searchPlaceholder: "खोजें...",
    notifications: "सूचनाएं",
    noNotifications: "कोई नई सूचना नहीं",
    chatHello: "नमस्ते! आज मैं आपकी पढ़ाई में कैसे मदद कर सकता हूँ?",
    typeMessage: "संदेश टाइप करें..."
  }
};

/* ------------------- CUSTOM COMPONENTS ------------------- */

const GlossyButton = ({
  icon: Icon,
  label,
  subLabel,
  variant = "blue",
  onClick,
  fullWidth = false,
  small = false,
}: {
  icon?: any;
  label: string;
  subLabel?: string;
  variant?: "blue" | "dark" | "green" | "crimson" | "yellow" | "orange" | "teal" | "purple";
  onClick?: () => void;
  fullWidth?: boolean;
  small?: boolean;
}) => {
  const styles = {
    blue: "bg-gradient-to-b from-[#60a5fa] to-[#2563eb] shadow-lg text-white border-t border-white/20",
    dark: "bg-[#111827]/80 backdrop-blur-sm shadow-lg text-white border border-white/10",
    green: "bg-gradient-to-b from-[#4ade80] to-[#16a34a] shadow-lg text-white border-t border-white/20",
    crimson: "bg-gradient-to-b from-[#f472b6] to-[#db2777] shadow-lg text-white border-t border-white/20",
    yellow: "bg-gradient-to-b from-[#facc15] to-[#ca8a04] shadow-lg text-white border-t border-white/20",
    orange: "bg-gradient-to-b from-[#fb923c] to-[#ea580c] shadow-[0_8px_20px_-6px_rgba(234,88,12,0.6)] text-white border-t border-white/20",
    teal: "bg-gradient-to-b from-[#2dd4bf] to-[#0d9488] shadow-lg text-white border-t border-white/20",
    purple: "bg-gradient-to-b from-[#a855f7] to-[#7e22ce] shadow-lg text-white border-t border-white/20",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative flex items-center justify-center gap-3 rounded-2xl transition-all duration-300 ${styles[variant]} ${fullWidth ? "w-full" : "w-auto"} ${small ? "px-4 py-2" : "px-5 py-4"}`}
    >
      {Icon && (
        <div className={`flex ${small ? 'h-6 w-6' : 'h-8 w-8'} items-center justify-center rounded-full bg-white/20 backdrop-blur-sm`}>
          <Icon size={small ? 14 : 18} className="text-white" />
        </div>
      )}
      <div className="flex flex-col text-left">
        <span className={`${small ? 'text-xs' : 'text-sm'} font-bold leading-none tracking-tight`}>{label}</span>
        {subLabel && !small && <span className="mt-1 text-[10px] font-medium opacity-90">{subLabel}</span>}
      </div>
      {!small && <div className="ml-auto opacity-80"><ChevronRight size={16} /></div>}
    </motion.button>
  );
};

const NavItem = ({ icon: Icon, label, active = false, to }: { icon: any, label: string, active?: boolean, to?: string }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ scale: 1.05, x: 5 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => to && navigate(to)}
      className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${active
          ? 'bg-[#111827]/90 text-white font-bold shadow-md border border-white/10'
          : 'text-slate-500 hover:bg-[#111827]/10 hover:text-black dark:text-slate-400 dark:hover:text-white'
        }`}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className="text-sm font-medium">{label}</span>
    </motion.div>
  )
}

const uniformGlassStyle = "bg-slate-200 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 rounded-[30px] shadow-sm p-6 transition-colors duration-300";

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  const { theme, toggleTheme } = useTheme(); // Hook for Dark Mode
  
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [lang, setLang] = useState<'en' | 'hi'>('en'); // Language State
  const t = translations[lang];

  // Header Interaction States
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Calendar Logic
  const date = new Date();
  const currentMonth = date.toLocaleString('default', { month: 'long' });
  const currentYear = date.getFullYear();
  const daysInMonth = new Date(currentYear, date.getMonth() + 1, 0).getDate();
  const currentDay = date.getDate();

  const recentTests = useMemo(() => [
    { id: 1, name: "Composition in web design", date: "June 09, 2026", status: "Active", type: "Web" },
    { id: 2, name: "Responsive vs. Adaptive", date: "June 10, 2026", status: "Active", type: "Design" },
    { id: 3, name: "8 point grid system in UX", date: "June 11, 2026", status: "Review", type: "UX" },
  ], []);

  const upcomingEvents = useMemo(() => [
    { id: 1, title: "Composition | Class 3A", time: "10:30", type: "Offline" },
    { id: 2, title: "Design Sys | Class 3B", time: "11:30", type: "Offline" },
  ], []);

  const studyStats = [
    { day: 'Mon', hours: 45, color: 'bg-blue-400' },
    { day: 'Tue', hours: 72, color: 'bg-purple-400' },
    { day: 'Wed', hours: 38, color: 'bg-teal-400' },
    { day: 'Thu', hours: 90, color: 'bg-orange-500' },
    { day: 'Fri', hours: 55, color: 'bg-crimson' },
    { day: 'Sat', hours: 25, color: 'bg-slate-400' },
    { day: 'Sun', hours: 15, color: 'bg-slate-300' },
  ];

  useEffect(() => {
    if (loading || !profile) return;
    if (searchParams.get("newUser") === "true" && !safeStorage.get("hasSeenCoinPopup")) {
      setTimeout(() => setShowScratchCard(true), 1500);
    }
  }, [loading, profile, searchParams]);

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'hi' : 'en');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F8F9FC] dark:bg-slate-900 text-gray-400">Loading...</div>;

  return (
    <div className={`min-h-screen font-sans flex overflow-hidden relative transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-800'}`}>
      <Suspense fallback={null}>
        <ScratchCard isOpen={showScratchCard} onClose={() => setShowScratchCard(false)} coins={100} />
      </Suspense>

      {/* --- SIDEBAR --- */}
      <aside className={`w-[260px] h-screen flex flex-col p-6 fixed left-0 top-0 z-20 hidden lg:flex backdrop-blur-md border-r transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900/60 border-white/10' : 'bg-white/60 border-white/50'}`}>
        <div className="flex items-center gap-4 mb-12 px-2">
          <img src="/ICON.ico" alt="Logo" className="w-12 h-12 object-contain" />
          <span className={`font-bold text-2xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>a4ai</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutGrid} label={t.dashboard} active to="/dashboard" />
          <NavItem icon={BookOpen} label={t.notes} to="/dashboard/notes" />
          <NavItem icon={MessageSquare} label={t.inbox} to="/dashboard/messages" />
          <NavItem icon={Users} label={t.students} to="/dashboard/leaderboard" />
          <NavItem icon={Settings} label={t.settings} to="/dashboard/settings" />
        </nav>

        <div className="mt-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-pink-500 p-6 text-center shadow-lg shadow-orange-200 dark:shadow-none">
            <h4 className="text-white font-bold mb-1">{t.getPremium}</h4>
            <p className="text-white/80 text-xs mb-4">{t.unlockFeatures}</p>
            {/* Upgrade Button Action */}
            <GlossyButton 
                label={t.upgradePlan} 
                variant="dark" 
                fullWidth 
                small 
                onClick={() => navigate('/dashboard/subscription')} 
            />
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 ml-0 lg:ml-[260px] p-4 lg:p-8 overflow-y-auto h-screen relative scroll-smooth">
        <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-8">

          {/* LEFT COLUMN (8/12) */}
          <div className="col-span-12 xl:col-span-8 flex flex-col gap-8">
            <header>
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {t.welcome}, {profile?.full_name?.split(' ')[0]}
              </h1>
              <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </header>

            {/* Banner */}
            <div className={`${uniformGlassStyle} relative p-8 flex justify-between items-center overflow-hidden`}>
              <div className="relative z-10 max-w-[70%]">
                <h2 className="text-2xl font-bold leading-tight mb-2">
                  {t.courseProgress} <span className="text-orange-600">73%</span>.
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">{t.levelUp}</p>
                <GlossyButton label={t.continueLearning} variant="orange" icon={Rocket} />
              </div>
              <div className="absolute right-0 bottom-0 h-full w-[30%] bg-[url('https://illustrations.popsy.co/amber/student-going-to-school.svg')] bg-contain bg-bottom bg-no-repeat opacity-10 grayscale dark:opacity-20"></div>
            </div>

            {/* Stats & Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={uniformGlassStyle}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.learningActivity}</h3>
                  <div className="flex items-center gap-1 text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-1 rounded-lg text-[10px] font-bold">
                    <TrendingUp size={12} /> +12.5%
                  </div>
                </div>

                <div className="flex items-end justify-between h-32 gap-3 px-2 mb-4">
                  {studyStats.map((item, i) => (
                    <div key={i} className="flex-1 group flex flex-col items-center gap-2">
                      <div className="w-full bg-white/40 dark:bg-black/20 rounded-2xl h-full relative overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${item.hours}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className={`absolute bottom-0 w-full rounded-2xl shadow-sm ${item.color}`}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{item.day}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-300/30 dark:border-slate-700">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{t.totalTime}</p>
                    <p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>24.5 hrs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{t.courses}</p>
                    <p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>08</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{t.rank}</p>
                    <p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>#12</p>
                  </div>
                </div>
              </div>

              <div className={`${uniformGlassStyle} flex flex-col gap-4`}>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.quickActions}</h3>
                <div className="flex-1 flex flex-col justify-center gap-3">
                  <Link to="/dashboard/contests"><GlossyButton label={t.joinContests} variant="blue" icon={Award} fullWidth /></Link>
                  <Link to="/dashboard/leaderboard"><GlossyButton label={t.leaderboard} variant="yellow" icon={Flame} fullWidth /></Link>
                </div>
              </div>
            </div>

            {/* Assignments Table */}
            <div className={uniformGlassStyle}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.upcomingAssignments}</h3>
                <GlossyButton label={t.allTests} variant="dark" small />
              </div>
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left text-slate-600 dark:text-slate-400">
                  <thead className="text-xs text-slate-400 border-b border-slate-300/30 dark:border-slate-700">
                    <tr><th className="pb-3">{t.testName}</th><th className="pb-3">{t.deadline}</th><th className="pb-3 text-right">{t.status}</th></tr>
                  </thead>
                  <tbody>
                    {recentTests.map((t) => (
                      <tr key={t.id} className="border-b border-slate-300/20 dark:border-slate-700 last:border-0">
                        <td className={`py-4 font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t.name}</td>
                        <td className="py-4 text-xs">{t.date}</td>
                        <td className="py-4 text-right"><span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-bold text-[10px]">{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (4/12) */}
          <div className="col-span-12 xl:col-span-4 flex flex-col gap-8">
            
            {/* --- NEW HEADER ACTION BAR --- */}
            <div className="flex justify-end gap-4 items-center h-[50px] relative">
              
              {/* Expanding Search Bar */}
              <motion.div 
                className={`flex items-center rounded-xl shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}
                initial={{ width: "40px" }}
                whileHover={{ width: "200px" }}
                animate={{ width: isSearchFocused ? "200px" : "40px" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <button className={`p-2.5 flex-shrink-0 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Search size={18} />
                </button>
                <input 
                  type="text" 
                  placeholder={t.searchPlaceholder} 
                  className={`bg-transparent border-none outline-none text-sm w-full pr-3 placeholder-slate-400 h-full ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
              </motion.div>

              {/* Animated Notification Bell (Opens on Hover) */}
              <div 
                  className="relative z-40"
                  onMouseEnter={() => setIsNotificationsOpen(true)}
                  onMouseLeave={() => setIsNotificationsOpen(false)}
              >
                  <motion.button 
                    whileHover={{ rotate: [0, -20, 20, -10, 10, 0], scale: 1.1 }}
                    className={`p-2.5 rounded-xl shadow-sm relative ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}`}
                  >
                    <Bell size={18} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-200 dark:border-slate-800"></span>
                  </motion.button>

                  <AnimatePresence>
                    {isNotificationsOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className={`absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-xl border overflow-hidden p-4 z-50 ${theme === 'dark' ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-800'}`}
                        >
                             <h5 className="font-bold text-sm mb-3">{t.notifications}</h5>
                             <div className="flex flex-col gap-2">
                                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30">
                                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">New Test Added!</p>
                                    <p className="text-[10px] opacity-70">Physics Chapter 3 mock test is live.</p>
                                </div>
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Class Reminder</p>
                                    <p className="text-[10px] opacity-70">Math class starts in 30 mins.</p>
                                </div>
                             </div>
                        </motion.div>
                    )}
                  </AnimatePresence>
              </div>

              {/* Profile Dropdown */}
              <div 
                className="relative z-50"
                onMouseEnter={() => setIsProfileOpen(true)}
                onMouseLeave={() => setIsProfileOpen(false)}
              >
                <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className={`flex items-center gap-2 cursor-pointer p-1.5 pr-4 rounded-full border shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-200/80 border-white/40'}`}
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            profile?.full_name?.charAt(0) || "U"
                        )}
                    </div>
                    <span className={`text-sm font-bold hidden lg:block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{t.profile}</span>
                </motion.div>

                <AnimatePresence>
                    {isProfileOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={`absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-xl border overflow-hidden p-2 backdrop-blur-xl ${theme === 'dark' ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-white/50'}`}
                        >
                            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 mb-1">
                                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{profile?.full_name || "Guest Student"}</p>
                                <p className="text-xs text-slate-500 truncate">{profile?.email || "student@example.com"}</p>
                            </div>
                            
                            <div className="space-y-1">
                                <Link to="/dashboard/settings" className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <User size={16} /> {t.profile}
                                </Link>
                                
                                {/* Dark Mode Toggle */}
                                <div onClick={toggleTheme} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                    {theme === 'dark' ? t.lightMode : t.darkMode}
                                </div>

                                {/* Language Toggle */}
                                <div onClick={toggleLanguage} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <Globe size={16} /> {t.language}
                                </div>

                                <Link to="/dashboard/settings" className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <Settings size={16} /> {t.settings}
                                </Link>
                                <div 
                                    onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
                                    className="flex items-center gap-3 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl cursor-pointer text-sm transition-colors mt-2 border-t border-slate-100 dark:border-slate-700"
                                >
                                    <LogOut size={16} /> {t.logOut}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>

            </div>

            {/* Calendar (Real Sync) */}
            <div className={uniformGlassStyle}>
              <h3 className={`font-bold mb-6 text-sm text-center ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{currentMonth} {currentYear}</h3>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const isToday = day === currentDay;
                    return (
                        <div key={i} className={`aspect-square flex items-center justify-center rounded-xl transition-all ${isToday ? 'bg-orange-500 text-white font-bold' : `${theme === 'dark' ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-300'}`}`}>
                            {day}
                        </div>
                    );
                })}
              </div>
            </div>

            {/* Extra Tools */}
            <div className={`${uniformGlassStyle} flex flex-col gap-4`}>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.extraTools}</h4>
              <div className="flex flex-col gap-3">
                <Link to="/dashboard/notes"><GlossyButton label={t.studyNotes} variant="green" icon={BookOpen} fullWidth /></Link>
                <Link to="/dashboard/analytics"><GlossyButton label={t.performance} variant="crimson" icon={BarChart3} fullWidth /></Link>
                <Link to="/dashboard/leaderboard"><GlossyButton label={t.students} variant="purple" icon={Users} fullWidth /></Link>
              </div>
            </div>

            {/* Upcoming Classes */}
            <div className={`${uniformGlassStyle} flex-1`}>
              <h3 className={`font-bold mb-6 text-xs uppercase tracking-widest opacity-60 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.upcomingClasses}</h3>
              <div className="space-y-4">
                {upcomingEvents.map((evt) => (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    key={evt.id} 
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800' : 'bg-white/40 border-white/60 hover:bg-white'}`}
                  >
                    <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300">{evt.time}</div>
                    <div className="flex-1 text-sm">
                      <h4 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{evt.title}</h4>
                      <p className="text-slate-400 text-[10px]">{evt.type} • {t.portal}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- CHATBOT FAB (Bloody Red & Interactive) --- */}
        <div 
            className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2"
            onMouseEnter={() => setIsChatOpen(true)}
            onMouseLeave={() => setIsChatOpen(false)}
        >
             <AnimatePresence>
                {isChatOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                        className={`mb-2 w-72 rounded-2xl shadow-2xl overflow-hidden border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
                    >
                        <div className="bg-gradient-to-r from-red-600 to-red-800 p-4 flex justify-between items-center text-white">
                            <span className="font-bold text-sm">AI Assistant</span>
                            <X size={14} className="cursor-pointer" />
                        </div>
                        <div className="p-4 h-64 overflow-y-auto text-sm space-y-3">
                            <div className={`p-3 rounded-lg rounded-tl-none ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                {t.chatHello}
                            </div>
                        </div>
                        <div className={`p-3 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                            <input 
                                type="text" 
                                placeholder={t.typeMessage}
                                className={`w-full text-xs p-2 rounded-full border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} 
                            />
                        </div>
                    </motion.div>
                )}
             </AnimatePresence>
             
            <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                className="w-16 h-16 bg-[#DC143C] hover:bg-[#B91C1C] rounded-full shadow-[0_0_20px_rgba(220,20,60,0.5)] flex items-center justify-center text-white border-4 border-white/10 transition-colors"
            >
                <MessageCircle size={32} fill="white" />
            </motion.button>
        </div>

      </main>
    </div>
  );
}
