import React, {
  useEffect,
  useState,
  useMemo,
  lazy,
  Suspense,
  useCallback,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";

const ScratchCard = lazy(() => import("@/components/ScratchCard"));

import {
  Bell,
  Search,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  Users,
  FileText,
  Settings,
  LogOut,
  Zap,
  Rocket,
  BarChart3,
  Flame,
  BookOpen,
  Award,
  TrendingUp,
  Menu,
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

/* ------------------- CUSTOM COMPONENTS ------------------- */

const GlossyButton = ({
  icon: Icon,
  label,
  subLabel,
  variant = "blue",
  onClick,
  fullWidth = false,
  small = false,
  className = "",
}: {
  icon?: any;
  label: string;
  subLabel?: string;
  variant?: "blue" | "dark" | "green" | "crimson" | "yellow" | "orange" | "teal" | "purple"; 
  onClick?: () => void;
  fullWidth?: boolean;
  small?: boolean;
  className?: string;
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
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex items-center justify-center gap-3 rounded-2xl transition-all duration-300 ${styles[variant]} ${fullWidth ? "w-full" : "w-auto"} ${small ? "px-3 py-2 md:px-4" : "px-4 py-3 md:px-5 md:py-4"} ${className}`}
    >
      {Icon && (
        <div className={`flex ${small ? 'h-5 w-5 md:h-6 md:w-6' : 'h-7 w-7 md:h-8 md:w-8'} items-center justify-center rounded-full bg-white/20 backdrop-blur-sm`}>
          <Icon size={small ? 14 : 18} className="text-white" />
        </div>
      )}
      <div className="flex flex-col text-left">
        <span className={`${small ? 'text-xs' : 'text-sm md:text-sm'} font-bold leading-none tracking-tight truncate`}>{label}</span>
        {subLabel && !small && <span className="mt-1 text-[10px] font-medium opacity-90 truncate">{subLabel}</span>}
      </div>
      {!small && <div className="ml-auto opacity-80 hidden md:block"><ChevronRight size={16} /></div>}
    </motion.button>
  );
};

const NavItem = ({ icon: Icon, label, active = false, to, onClick }: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  to?: string,
  onClick?: () => void 
}) => {
  const navigate = useNavigate();
  const handleClick = useCallback(() => {
    if (to) navigate(to);
    if (onClick) onClick();
  }, [to, navigate, onClick]);

  return (
    <div 
      onClick={handleClick}
      className={`flex items-center gap-3 md:gap-4 p-3 rounded-xl md:rounded-2xl cursor-pointer transition-all ${
          active 
          ? 'bg-[#111827]/90 text-white font-bold shadow-md border border-white/10' 
          : 'text-slate-500 hover:bg-[#111827]/10 hover:text-black'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
      <span className="text-sm font-medium truncate">{label}</span>
    </div>
  )
};

const uniformGlassStyle = "bg-slate-200 border border-slate-300/50 rounded-2xl md:rounded-[30px] shadow-sm p-4 md:p-6";

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Update window width on resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu on larger screens
  useEffect(() => {
    if (windowWidth >= 1024 && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [windowWidth, mobileMenuOpen]);

  const recentTests = useMemo(() => [
      { id: 1, name: "Composition in web design", date: "June 09, 2022", status: "Active", type: "Web" },
      { id: 2, name: "Responsive vs. Adaptive", date: "June 10, 2022", status: "Active", type: "Design" },
      { id: 3, name: "8 point grid system in UX", date: "June 11, 2022", status: "Review", type: "UX" },
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F8F9FC] text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans text-slate-800 flex overflow-hidden">
      <Suspense fallback={null}>
        <ScratchCard isOpen={showScratchCard} onClose={() => setShowScratchCard(false)} coins={100} />
      </Suspense>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.3 }}
              className="w-[280px] h-screen flex flex-col p-6 fixed left-0 top-0 z-50 bg-white/95 backdrop-blur-md border-r border-white/50 lg:hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <img src="/ICON.ico" alt="Logo" className="w-10 h-10 object-contain" />
                  <span className="font-bold text-xl tracking-tight text-slate-800">a4ai</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                <NavItem icon={LayoutGrid} label="Dashboard" active to="/dashboard" onClick={() => setMobileMenuOpen(false)} />
                <NavItem icon={BookOpen} label="Notes" to="/dashboard/notes" onClick={() => setMobileMenuOpen(false)} />
                <NavItem icon={MessageSquare} label="Inbox" to="/dashboard/messages" onClick={() => setMobileMenuOpen(false)} />
                <NavItem icon={Users} label="Students" to="/dashboard/leaderboard" onClick={() => setMobileMenuOpen(false)} />
                <NavItem icon={Settings} label="Settings" to="/dashboard/settings" onClick={() => setMobileMenuOpen(false)} />
              </nav>

              <div className="mt-auto">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 p-5 text-center shadow-lg shadow-orange-200 mb-4">
                  <h4 className="text-white font-bold mb-1 text-sm">Get Premium</h4>
                  <p className="text-white/80 text-xs mb-3">Unlock all features</p>
                  <GlossyButton label="Upgrade Plan" variant="dark" fullWidth small />
                </div>
                <div 
                  className="flex items-center gap-3 p-3 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                  onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
                >
                  <LogOut size={18} />
                  <span className="text-sm font-medium">Log out</span>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className={`w-[260px] h-screen flex flex-col p-6 fixed left-0 top-0 z-20 hidden lg:flex bg-white/60 backdrop-blur-md border-r border-white/50`}>
        <div className="flex items-center gap-4 mb-12 px-2">
          <img src="/ICON.ico" alt="Logo" className="w-12 h-12 object-contain" />
          <span className="font-bold text-2xl tracking-tight text-slate-800">a4ai</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutGrid} label="Dashboard" active to="/dashboard" />
          <NavItem icon={BookOpen} label="Notes" to="/dashboard/notes" />
          <NavItem icon={MessageSquare} label="Inbox" to="/dashboard/messages" />
          <NavItem icon={Users} label="Students" to="/dashboard/leaderboard" />
          <NavItem icon={Settings} label="Settings" to="/dashboard/settings" />
        </nav>

        <div className="mt-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-pink-500 p-6 text-center shadow-lg shadow-orange-200">
            <h4 className="text-white font-bold mb-1">Get Premium</h4>
            <p className="text-white/80 text-xs mb-4">Unlock all features</p>
            <GlossyButton label="Upgrade Plan" variant="dark" fullWidth small />
          </div>
          <div 
            className="mt-6 flex items-center gap-3 px-2 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" 
            onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Log out</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-0 lg:ml-[260px] p-3 sm:p-4 lg:p-6 xl:p-8 overflow-y-auto h-screen">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-6 p-2">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <img src="/ICON.ico" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-lg tracking-tight text-slate-800">a4ai</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-white/80 rounded-xl shadow-sm"><Search size={18} /></button>
            <button className="p-2 bg-white/80 rounded-xl shadow-sm relative"><Bell size={18} /><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span></button>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-4 sm:gap-6 md:gap-8">
          {/* Left Column - Full width on mobile, 8 columns on desktop */}
          <div className="col-span-12 xl:col-span-8 flex flex-col gap-4 sm:gap-6 md:gap-8">
            {/* Header */}
            <div className="px-2 sm:px-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">Welcome back, {profile?.full_name?.split(' ')[0]}</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Progress Card */}
            <div className={`${uniformGlassStyle} relative p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 overflow-hidden`}>
              <div className="relative z-10 max-w-full sm:max-w-[70%]">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight mb-2">
                  Your average course progress is <span className="text-orange-600">73%</span>.
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mb-4 sm:mb-6 font-medium">Level up your learning to improve your student rank!</p>
                
                {/* यहाँ Link component add किया है */}
                <Link to="/dashboard/practice">
                  <GlossyButton label="PYQ Practice!!" variant="orange" icon={Rocket} className="w-full sm:w-auto" />
                </Link>
              </div>
              <div className="absolute right-0 bottom-0 h-40 w-40 sm:h-full sm:w-[30%] bg-[url('https://illustrations.popsy.co/amber/student-going-to-school.svg')] bg-contain bg-bottom bg-no-repeat opacity-10 grayscale"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Learning Activity */}
              <div className={uniformGlassStyle}>
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">Learning Activity</h3>
                  <div className="flex items-center gap-1 text-teal-600 bg-teal-50 px-2 py-1 rounded-lg text-[10px] font-bold">
                    <TrendingUp size={10} className="hidden sm:block" /> +12.5%
                  </div>
                </div>
                
                <div className="flex items-end justify-between h-28 sm:h-32 gap-2 sm:gap-3 px-1 sm:px-2 mb-4">
                  {studyStats.map((item, i) => (
                    <div key={i} className="flex-1 group flex flex-col items-center gap-1 sm:gap-2">
                      <div className="w-full bg-white/40 rounded-xl sm:rounded-2xl h-full relative overflow-hidden shadow-inner">
                        <motion.div 
                          initial={{ height: 0 }} 
                          animate={{ height: `${item.hours}%` }} 
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className={`absolute bottom-0 w-full rounded-xl sm:rounded-2xl shadow-sm ${item.color}`} 
                        />
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400">{item.day}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between items-center pt-3 sm:pt-4 border-t border-slate-300/30">
                  <div className="text-center">
                    <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Time</p>
                    <p className="text-xs sm:text-sm font-black text-slate-700">24.5 hrs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold tracking-wider">Courses</p>
                    <p className="text-xs sm:text-sm font-black text-slate-700">08</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold tracking-wider">Rank</p>
                    <p className="text-xs sm:text-sm font-black text-slate-700">#12</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className={`${uniformGlassStyle} flex flex-col gap-3 sm:gap-4`}>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Quick Actions</h3>
                <div className="flex-1 flex flex-col justify-center gap-2 sm:gap-3">
                  <Link to="/dashboard/contests" className="block">
                    <GlossyButton label="Join Contests" variant="blue" icon={Award} fullWidth />
                  </Link>
                  <Link to="/dashboard/leaderboard" className="block">
                    <GlossyButton label="Leaderboard" variant="yellow" icon={Flame} fullWidth />
                  </Link>
                </div>
              </div>
            </div>

            {/* Upcoming Assignments */}
            <div className={uniformGlassStyle}>
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Upcoming Assignments</h3>
                <GlossyButton label="All tests" variant="dark" small />
              </div>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[500px] text-left text-slate-600">
                  <thead className="text-xs text-slate-400 border-b border-slate-300/30">
                    <tr>
                      <th className="pb-3 px-2 sm:px-0">Test name</th>
                      <th className="pb-3 px-2 sm:px-0">Deadline</th>
                      <th className="pb-3 px-2 sm:px-0 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTests.map((t) => (
                      <tr key={t.id} className="border-b border-slate-300/20 last:border-0">
                        <td className="py-3 sm:py-4 font-semibold text-slate-700 text-xs sm:text-sm px-2 sm:px-0 truncate max-w-[150px] sm:max-w-none">{t.name}</td>
                        <td className="py-3 sm:py-4 text-xs px-2 sm:px-0">{t.date}</td>
                        <td className="py-3 sm:py-4 text-right px-2 sm:px-0">
                          <span className="bg-orange-100 text-orange-600 px-2 py-1 sm:px-3 sm:py-1 rounded-full font-bold text-[10px] inline-block min-w-[60px] text-center">{t.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Full width on mobile, 4 columns on desktop */}
          <div className="col-span-12 xl:col-span-4 flex flex-col gap-4 sm:gap-6 md:gap-8">
            {/* Desktop Search & Notifications */}
            <div className="hidden lg:flex justify-end gap-4 items-center h-[40px]">
              <button className="p-2 bg-slate-200 rounded-xl shadow-sm"><Search size={18} /></button>
              <button className="p-2 bg-slate-200 rounded-xl shadow-sm relative"><Bell size={18} /><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-200"></span></button>
            </div>

            {/* Profile Card */}
            <div className={`${uniformGlassStyle} flex items-center gap-3 sm:gap-4`}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500 font-bold text-lg sm:text-xl flex-shrink-0">
                {profile?.full_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">{profile?.full_name}</h3>
                <p className="text-slate-500 text-xs truncate">{profile?.email}</p>
              </div>
            </div>

            {/* Calendar */}
            <div className={uniformGlassStyle}>
              <h3 className="font-bold text-slate-800 mb-4 sm:mb-6 text-xs sm:text-sm text-center">June 2026</h3>
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs">
                {Array.from({length: 28}, (_, i) => (
                  <div 
                    key={i} 
                    className={`aspect-square flex items-center justify-center rounded-lg sm:rounded-xl transition-all ${
                      i === 7 
                        ? 'bg-orange-500 text-white font-bold' 
                        : 'text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {i+1}
                  </div>
                ))}
              </div>
            </div>

            {/* Extra Tools */}
            <div className={`${uniformGlassStyle} flex flex-col gap-3 sm:gap-4`}>
              <h4 className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Extra Tools</h4>
              <div className="flex flex-col gap-2 sm:gap-3">
                <Link to="/dashboard/notes" className="block">
                  <GlossyButton label="Study Notes" variant="green" icon={BookOpen} fullWidth />
                </Link>
                <Link to="/dashboard/analytics" className="block">
                  <GlossyButton label="Performance" variant="crimson" icon={BarChart3} fullWidth />
                </Link>
                <Link to="/dashboard/leaderboard" className="block">
                  <GlossyButton label="Students" variant="purple" icon={Users} fullWidth />
                </Link>
              </div>
            </div>

            {/* Upcoming Classes */}
            <div className={`${uniformGlassStyle} flex-1`}>
              <h3 className="font-bold text-slate-800 mb-4 sm:mb-6 text-xs uppercase tracking-widest opacity-60">Upcoming Classes</h3>
              <div className="space-y-3 sm:space-y-4">
                {upcomingEvents.map((evt) => (
                  <div 
                    key={evt.id} 
                    className="flex items-center gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/40 border border-white/60 hover:bg-white transition-all cursor-pointer"
                  >
                    <div className="bg-slate-200 px-2 py-1 sm:px-3 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold text-slate-700 whitespace-nowrap">
                      {evt.time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{evt.title}</h4>
                      <p className="text-slate-400 text-[9px] sm:text-[10px] truncate">{evt.type} • Portal</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}