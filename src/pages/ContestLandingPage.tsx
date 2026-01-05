import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

// icons
import {
  Search,
  Filter,
  Calendar,
  Trophy,
  Users,
  Clock,
  Star,
  Award,
  BookOpen,
  Zap,
  Flame,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
  Crown,
  LayoutGrid,
  X,
  Menu,
  TrendingUp,
  BarChart3,
  Target,
  Loader2
} from "lucide-react";

// contexts
import { useCoins } from "@/context/CoinContext";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

/* ---------------------------
   Types
---------------------------- */
interface Contest {
  id: string;
  title: string;
  participants: number;
  duration: string;
  difficulty: "Easy" | "Medium" | "Hard";
  status: "upcoming" | "ongoing" | "completed";
  acceptance: string;
  startTime: string;
}

interface Problem {
  id: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  acceptance: string;
}

interface MegaContest {
  id: string;
  contest_code: string;
  title: string;
  class: string;
  description: string;
  subjects: string[];
  start_time: string;
  end_time: string;
  created_at: string;
  total_questions?: number;
  total_marks?: number;
}

/* -------------------------------------------
   Premium Bento FlashCard (Optimized)
-------------------------------------------- */
function PremiumFlashCard({
   onClick,
   title,
   subtitle,
   badge,
   cta,
   gradient,
   icon,
   isTrending = false,
   isPopular = false,
   isLoading = false,
 }: {
   onClick: () => void;
   title: string;
   subtitle: string;
   badge: string;
   cta: string;
   gradient: string;
   icon: React.ReactNode;
   isTrending?: boolean;
   isPopular?: boolean;
   isLoading?: boolean;
 }) {
   return (
     <motion.div
       whileHover={{ y: -4, scale: 1.02 }}
       whileTap={{ scale: 0.98 }}
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       className="relative h-full w-full"
     >
       <div
         onClick={isLoading ? undefined : onClick}
         className={clsx(
           "group relative overflow-hidden rounded-[16px] sm:rounded-[20px] md:rounded-[24px] h-[160px] sm:h-[180px] md:h-[200px] transition-all duration-300",
           isLoading 
             ? "bg-gradient-to-br from-gray-200 to-gray-300 cursor-not-allowed"
             : "cursor-pointer",
           !isLoading && "shadow-[0_4px_12px_-8px_rgba(0,0,0,0.15)] hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]",
           !isLoading && gradient
         )}
       >
         {isLoading ? (
           <div className="h-full flex items-center justify-center">
             <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
           </div>
         ) : (
           <>
             {/* Gradient Overlay */}
             <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300">
               <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
             </div>
             
             {/* Noise Texture */}
             <div className="absolute inset-0 opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
             
             {/* Top Right Live Badge */}
             <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
               <Badge className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 text-xs font-bold animate-pulse shadow-lg">
                 LIVE
               </Badge>
             </div>
     
             {/* Top Left Icon */}
             <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
               <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                 {icon}
               </div>
             </div>
     
             {/* Content */}
             <div className="relative z-10 h-full flex flex-col justify-between p-4 sm:p-5 md:p-6">
               <div className="space-y-2 sm:space-y-3">
                 {/* Title - Top Aligned */}
                 <div className="pr-10 sm:pr-12 mt-8"> 
                   <h3 className="text-base sm:text-lg md:text-xl font-bold text-white leading-tight tracking-tight drop-shadow-lg line-clamp-2">
                     {title}
                   </h3>
                   {/* Subtitle removed as requested */}
                 </div>
               </div>
     
               {/* Join Now Button - Centered */}
               <div className="flex justify-center">
                 <motion.div 
                   className="w-full max-w-[180px]"
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                 >
                   <button className="w-full flex items-center justify-center px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white/95 hover:bg-white text-slate-900 text-xs sm:text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] group/btn">
                     <span>{cta}</span>
                     <div className="w-5 h-5 rounded-full bg-slate-100 group-hover/btn:bg-slate-200 transition-colors flex items-center justify-center ml-2">
                       <ChevronRight size={12} className="text-slate-600" />
                     </div>
                   </button>
                 </motion.div>
               </div>
             </div>
           </>
         )}
       </div>
     </motion.div>
   );
 }

/* ---------------------------
   Main Page - Optimized
---------------------------- */
const ContestLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { coins } = useCoins();
  const { userProfile } = useAuth();
  const [activeTopic, setActiveTopic] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [megaContests, setMegaContests] = useState<MegaContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    streak: 7,
    rating: 1420,
    rank: "Top 20%",
    solved: 162
  });

  // Fetch mega contests from database
  useEffect(() => {
    const fetchMegaContests = async () => {
      try {
        const { data, error } = await supabase
          .from('mega_contests')
          .select('*')
          .order('start_time', { ascending: true })
          .limit(8);

        if (error) throw error;
        setMegaContests(data || []);
      } catch (error) {
        console.error('Error fetching mega contests:', error);
        toast.error('Failed to load contests');
      } finally {
        setLoading(false);
      }
    };

    fetchMegaContests();
  }, []);

  const handleBack = () => navigate(-1);
  const handleDashboardClick = () => navigate("/dashboard");

  // Mega Contest hero cards - Dynamic from database
  const heroCards = useMemo(() => {
    const gradients = [
      "bg-gradient-to-br from-purple-500 to-pink-500",
      "bg-gradient-to-br from-blue-500 to-cyan-500",
      "bg-gradient-to-br from-green-500 to-emerald-600",
      "bg-gradient-to-br from-orange-500 to-red-500",
      "bg-gradient-to-br from-indigo-500 to-purple-600",
      "bg-gradient-to-br from-teal-500 to-green-500",
      "bg-gradient-to-br from-red-500 to-orange-500",
      "bg-gradient-to-br from-yellow-500 to-amber-500"
    ];
    
    if (loading) {
      return Array(4).fill(0).map((_, index) => ({
        id: `loading-${index}`,
        key: `loading-${index}`,
        title: "Loading...",
        subtitle: "",
        cta: "Loading...",
        gradient: gradients[index % gradients.length],
        badge: "Mega",
        icon: <Crown className="h-4 w-4 sm:h-5 sm:w-5" />,
        isLoading: true
      }));
    }
    
    if (megaContests.length > 0) {
      return megaContests.slice(0, 4).map((contest, index) => {
        const now = new Date();
        const startTime = new Date(contest.start_time);
        const endTime = new Date(contest.end_time);
        const isLive = now >= startTime && now <= endTime;
        
        return {
          id: contest.id,
          key: `contest-${contest.id}-${index}`,
          title: contest.title,
          subtitle: "",
          cta: isLive ? "Join Now" : "View Details",
          gradient: gradients[index % gradients.length],
          badge: contest.class === '11' || contest.class === '12' ? 'PCMB' : 'Mega',
          icon: <Crown className="h-4 w-4 sm:h-5 sm:w-5" />,
          isTrending: index === 0,
          isPopular: index === 1,
          contestData: contest
        };
      });
    }
    
    // Fallback if no contests in DB
    return [
      { 
        id: 1, 
        key: "class9-1", 
        title: "Class 9 Mega Test", 
        subtitle: "",
        cta: "Coming Soon", 
        gradient: gradients[0],
        badge: "Mega", 
        icon: <Crown className="h-4 w-4 sm:h-5 sm:w-5" />, 
        isTrending: true 
      },
      { 
        id: 2, 
        key: "class10-2", 
        title: "Class 10 Mega Test", 
        subtitle: "",
        cta: "Coming Soon", 
        gradient: gradients[1], 
        badge: "Mega", 
        icon: <Crown className="h-4 w-4 sm:h-5 sm:w-5" />, 
        isPopular: true 
      },
      { 
        id: 3, 
        key: "class11-3", 
        title: "Class 11 Mega Test", 
        subtitle: "",
        cta: "Coming Soon", 
        gradient: gradients[2], 
        badge: "PCMB", 
        icon: <Crown className="h-4 w-4 sm:h-5 sm:w-5" /> 
      },
      { 
        id: 4, 
        key: "class12-4", 
        title: "Class 12 Mega Test", 
        subtitle: "",
        cta: "Coming Soon", 
        gradient: gradients[3], 
        badge: "PCMB", 
        icon: <Crown className="h-4 w-4 sm:h-5 sm:w-5" /> 
      },
    ];
  }, [megaContests, loading]);

  const topics = useMemo(() => [
    { name: "All", count: 42, icon: <LayoutGrid size={12} className="sm:size-[14px]" />, color: "bg-slate-200" },
    { name: "Class 10", count: 8, icon: "🔟", color: "bg-blue-100" },
    { name: "Class 11", count: 12, icon: "1️⃣1️⃣", color: "bg-green-100" },
    { name: "Class 12", count: 15, icon: "1️⃣2️⃣", color: "bg-purple-100" },
    { name: "JEE", count: 14, icon: "⚛️", color: "bg-red-100" },
    { name: "NEET", count: 10, icon: "🧬", color: "bg-green-100" },
    { name: "Physics", count: 11, icon: "⚡", color: "bg-orange-100" },
    { name: "Chemistry", count: 9, icon: "🧪", color: "bg-blue-100" },
    { name: "Maths", count: 13, icon: "📐", color: "bg-indigo-100" },
  ], []);

  const contests: Contest[] = useMemo(() => [
    { id: "jee-sprint-5", title: "JEE Sprint #5 — Mechanics", participants: 980, duration: "60m", difficulty: "Medium", status: "upcoming", acceptance: "—", startTime: "Starts in 2d" },
    { id: "cbse-x-physics", title: "Class 10 — Light & Electricity", participants: 310, duration: "40m", difficulty: "Easy", status: "ongoing", acceptance: "—", startTime: "Ends in 32m" },
    { id: "neet-bio", title: "NEET Biology — Genetics", participants: 540, duration: "45m", difficulty: "Medium", status: "upcoming", acceptance: "—", startTime: "Starts in 4d" },
    { id: "cbse-chem", title: "Class 12 — Organic Chem", participants: 120, duration: "90m", difficulty: "Hard", status: "completed", acceptance: "42%", startTime: "Ended yesterday" },
  ], []);

  const problems: Problem[] = useMemo(() => [
    { id: 1, title: "Gravitation — g at height h", difficulty: "Easy", acceptance: "78%" },
    { id: 2, title: "Chemical Kinetics — rate law", difficulty: "Medium", acceptance: "63%" },
    { id: 3, title: "Vectors — resultant magnitude", difficulty: "Medium", acceptance: "55%" },
    { id: 4, title: "Human Physiology — blood groups", difficulty: "Hard", acceptance: "49%" },
  ], []);

  const filteredContests = contests.filter((c) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch = c.title.toLowerCase().includes(s);
    const matchesDiff = difficultyFilter === "all" || c.difficulty.toLowerCase() === difficultyFilter;
    return matchesSearch && matchesDiff;
  });

  const handleContestAction = useCallback((contest: Contest) => {
    if (contest.status === "upcoming") navigate(`/contests/preview/${contest.id}`);
    else if (contest.status === "ongoing") navigate(`/contests/live/${contest.id}`);
    else navigate(`/contests/${contest.id}`);
  }, [navigate]);

  // Handle Mega Contest card clicks
  const handleCardClick = useCallback((cardKey: string, contestData?: MegaContest) => {
    if (contestData?.contest_code) {
      // Navigate to mega contest using contest_code
      navigate(`/mega-contest/${contestData.contest_code}`);
    } else {
      // Fallback for demo contests
      toast.info('Contest details loading...');
    }
  }, [navigate]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name.charAt(0).toUpperCase();
    }
    return "T";
  };

  if (loading && megaContests.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading contests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-indigo-500/20 selection:text-indigo-800 pb-20">
      
      {/* Header - Optimized */}
      <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
          <div className="h-[64px] sm:h-[72px] flex items-center justify-between gap-3">
            
            {/* Left: Branding & Back */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBack}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
              >
                <ArrowLeft size={20} strokeWidth={2.5} />
              </motion.button>

              <motion.div 
                className="flex items-center gap-2.5 cursor-pointer" 
                onClick={() => navigate("/")}
                whileHover={{ scale: 1.02 }}
              >
                <img 
                  src="/images/LOGO.png" 
                  alt="a4ai Logo" 
                  className="h-7 sm:h-9 w-auto object-contain" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">a4ai <span className="text-indigo-600">Contest Zone</span></h1>
                </div>
              </motion.div>
            </div>

            {/* Center: Search (Desktop) */}
            <div className="hidden md:flex flex-1 max-w-xl px-4">
              <motion.div 
                className="relative w-full group"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contests, topics..."
                  className="pl-10 h-10 rounded-xl bg-slate-100/80 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-3 focus:ring-indigo-500/20 transition-all"
                />
              </motion.div>
            </div>

            {/* Right: Coins & Profile */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              
              {/* Mobile Search Toggle */}
              <motion.button 
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                whileTap={{ scale: 0.9 }}
              >
                {isMobileSearchOpen ? <X size={20} /> : <Search size={20} />}
              </motion.button>

              {/* Coin Balance */}
              <motion.div 
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200/50 cursor-pointer hover:shadow-md transition-all"
                onClick={() => navigate('/coinshop')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  <Award size={12} />
                </div>
                <span className="font-bold text-amber-800 text-sm">{coins.toLocaleString()}</span>
              </motion.div>

              {/* User Profile */}
              <motion.div 
                onClick={handleDashboardClick}
                className="flex items-center gap-2.5 pl-1.5 pr-3 sm:pr-4 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all shadow-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-sm">
                  {getUserInitials()}
                </div>
                <span className="text-sm font-bold text-slate-700 hidden sm:block">{userProfile?.full_name || "Tarun"}</span>
              </motion.div>
            </div>
          </div>

          {/* Mobile Search Bar (Dropdown) */}
          <AnimatePresence>
            {isMobileSearchOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pb-3 pt-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contests..."
                    autoFocus
                    className="w-full h-11 rounded-xl bg-slate-100/80 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-10">
        
        {/* 1. Welcome Section */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Ready to Compete, <br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                {userProfile?.full_name?.split(' ')[0] || "Tarun"}?
              </span>
            </h1>
            <p className="text-slate-500 mt-2 font-medium text-sm sm:text-base">
              Your <span className="text-amber-500 font-bold">{userStats.streak} day streak</span> is active. Keep it up!
            </p>
          </motion.div>
          
          {/* Quick Stats Grid */}
          <motion.div 
            className="flex flex-wrap items-center gap-2 sm:gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <Trophy size={16} className="text-yellow-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">{userStats.rank}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <BarChart3 size={16} className="text-indigo-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">{userStats.rating}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <Target size={16} className="text-green-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">{userStats.solved} solved</span>
            </div>
          </motion.div>
        </section>

        {/* 2. Hero FlashCards - Mega Contests */}
        <section>
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-500" /> Mega Contests
            </h2>
            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
              Live Today
            </Badge>
          </div>
          
          {/* Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {heroCards.map((card) => (
              <PremiumFlashCard 
                key={card.key} 
                {...card} 
                onClick={() => handleCardClick(card.key, card.contestData)} 
              />
            ))}
          </div>
        </section>

        {/* 3. Main Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8">
          
          {/* Left Column (Content) */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8">
            
            {/* Topic Pills */}
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Browse Topics</h3>
                <span className="text-xs text-slate-400">{topics.reduce((sum, t) => sum + t.count, 0)} topics</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                {topics.map((topic, index) => {
                  const key = topic.name.toLowerCase();
                  const active = activeTopic === key;
                  return (
                    <motion.button
                      key={`${topic.name}-${index}`}
                      onClick={() => setActiveTopic(key)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border shrink-0",
                        active 
                          ? "bg-gradient-to-r from-slate-900 to-slate-800 border-slate-900 text-white shadow-lg" 
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-base">{topic.icon}</span>
                      {topic.name}
                      {active && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs ml-1.5">
                          {topic.count}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Modern Tabbed Content */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <Tabs defaultValue="contests" className="w-full">
                <div className="border-b border-slate-100 bg-slate-50/50 px-5 sm:px-6 pt-5 sm:pt-6 pb-0">
                  <TabsList className="bg-slate-200/50 p-1 rounded-xl w-full sm:w-auto flex h-11 sm:h-12">
                    <TabsTrigger value="contests" className="flex-1 sm:flex-none rounded-lg px-5 sm:px-6 h-9 text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600">
                      <Calendar size={16} className="mr-2 hidden sm:inline" />
                      Live Contests
                    </TabsTrigger>
                    <TabsTrigger value="problems" className="flex-1 sm:flex-none rounded-lg px-5 sm:px-6 h-9 text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600">
                      <BookOpen size={16} className="mr-2 hidden sm:inline" />
                      Practice Bank
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="contests" className="p-0 m-0">
                  <div className="divide-y divide-slate-100">
                    {filteredContests.length > 0 ? (
                      filteredContests.map((c, i) => (
                        <ContestRow key={c.id} data={c} onAction={handleContestAction} index={i} />
                      ))
                    ) : (
                      <div className="p-10 text-center">
                        <Search size={48} className="text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-medium">No contests found.</p>
                        <p className="text-slate-400 text-sm mt-1">Try a different search term</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="problems" className="p-0 m-0">
                  <div className="divide-y divide-slate-100">
                    {problems.map((p, i) => (
                      <ProblemRow key={`problem-${p.id}-${i}`} data={p} onClick={() => {}} index={i} />
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <SafetyNote />
          </div>

          {/* Right Column (Widgets) */}
          <div className="lg:col-span-4 space-y-5 sm:space-y-6">
            <CoinsCard coins={coins} />
            <ScheduleWidget />
            <div className="hidden lg:block"><ProfileWidget userStats={userStats} /></div>
            <WeeklyChallenge />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------
   Refined Sub-Components
---------------------------- */

function ContestRow({ data, onAction, index }: { data: Contest, onAction: any, index: number }) {
  const isOngoing = data.status === "ongoing";
  const isUpcoming = data.status === "upcoming";
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onAction(data)}
      className={clsx(
        "p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer group relative",
        isOngoing && "bg-gradient-to-r from-indigo-50/50 to-blue-50/50"
      )}
    >
      {/* Status Indicator */}
      <div className={clsx(
        "absolute top-4 right-4 w-2 h-2 rounded-full",
        isOngoing ? "bg-green-500 animate-pulse" : 
        isUpcoming ? "bg-amber-500" : "bg-slate-400"
      )} />
      
      <div className="flex w-full sm:w-auto items-start gap-4">
        {/* Icon */}
        <div className={clsx(
          "w-12 h-12 rounded-2xl flex shrink-0 items-center justify-center shadow-lg",
          isOngoing ? "bg-gradient-to-br from-green-100 to-emerald-100 text-green-600" : 
          isUpcoming ? "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600" :
          "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500"
        )}>
          {isOngoing ? <Zap size={22} className="fill-green-500/30" /> : 
           isUpcoming ? <Clock size={22} /> : <Calendar size={22} />}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isOngoing && (
              <Badge className="bg-green-500 hover:bg-green-600 text-white px-2 py-0.5 text-xs">
                LIVE
              </Badge>
            )}
            <Badge variant="outline" className={clsx(
              "text-xs font-medium",
              data.difficulty === "Easy" ? "border-green-200 text-green-700 bg-green-50" :
              data.difficulty === "Medium" ? "border-amber-200 text-amber-700 bg-amber-50" :
              "border-red-200 text-red-700 bg-red-50"
            )}>
              {data.difficulty}
            </Badge>
          </div>
          
          <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
            {data.title}
          </h4>
          
          <div className="flex flex-wrap items-center gap-3 mt-2.5 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {data.participants.toLocaleString()} participants
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {data.startTime}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="w-full sm:w-auto mt-3 sm:mt-0">
        <Button 
          size="sm"
          className={clsx(
            "rounded-xl font-bold px-6 h-10 w-full sm:w-auto shadow-md transition-all",
            isOngoing 
              ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white" 
              : "bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-lg"
          )}
        >
          {isOngoing ? "Join Now" : 
           isUpcoming ? "Preview" : "View Results"}
          <ChevronRight size={16} className="ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function ProblemRow({ data, onClick, index }: { data: Problem, onClick: any, index: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer group"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex shrink-0 items-center justify-center text-slate-600 font-bold text-sm group-hover:from-indigo-100 group-hover:to-purple-100 group-hover:text-indigo-600 transition-all shadow-sm">
          #{data.id}
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700 line-clamp-2">
            {data.title}
          </h4>
          <div className="flex items-center gap-3 mt-1.5">
            <Badge variant="outline" className={clsx(
              "text-xs font-medium px-2",
              data.difficulty === "Easy" ? "border-green-200 text-green-700 bg-green-50" :
              data.difficulty === "Medium" ? "border-amber-200 text-amber-700 bg-amber-50" :
              "border-red-200 text-red-700 bg-red-50"
            )}>
              {data.difficulty}
            </Badge>
            <span className="text-xs text-slate-500">Acc: {data.acceptance}</span>
          </div>
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
    </motion.div>
  );
}

function CoinsCard({ coins }: { coins: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-5 sm:p-6 text-white shadow-xl"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-300 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-amber-100 text-sm font-medium mb-1">Your Balance</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black tracking-tight">{coins.toLocaleString()}</span>
              <span className="text-xl opacity-80">©</span>
            </div>
            <p className="text-amber-100/80 text-sm mt-2">Earn more by solving problems</p>
          </div>
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg">
            <Award size={24} className="text-white" />
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => window.location.href = '/coinshop'}
          className="w-full bg-white text-amber-700 font-bold h-12 rounded-xl shadow-lg hover:shadow-xl hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles size={16} />
          Redeem Rewards
        </motion.button>
      </div>
    </motion.div>
  );
}

function ScheduleWidget() {
  const [currentDate] = useState(new Date());
  
  const days = [
    { id: 0, label: 'S', full: 'Sunday' },
    { id: 1, label: 'M', full: 'Monday' },
    { id: 2, label: 'T', full: 'Tuesday' },
    { id: 3, label: 'W', full: 'Wednesday' },
    { id: 4, label: 'T', full: 'Thursday' },
    { id: 5, label: 'F', full: 'Friday' },
    { id: 6, label: 'S', full: 'Saturday' }
  ];
  
  const today = currentDate.getDate();
  const currentDay = currentDate.getDay();
  
  return (
    <Card className="rounded-2xl sm:rounded-3xl border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <Calendar size={20} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Study Calendar</h3>
            <p className="text-slate-500 text-sm">Upcoming tests & deadlines</p>
          </div>
        </div>
        
        {/* Date Strip - FIXED: Added unique keys */}
        <div className="flex justify-between mb-6">
          {days.map((day, index) => {
            const date = today - currentDay + index;
            const isToday = index === currentDay;
            return (
              <div key={`${day.full}-${day.id}`} className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-slate-500">{day.label}</span>
                <div className={clsx(
                  "w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all",
                  isToday 
                    ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg scale-110" 
                    : "text-slate-700 hover:bg-slate-100"
                )}>
                  {date}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Upcoming Event */}
        <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-4 rounded-xl border border-indigo-100">
          <div className="flex gap-3">
            <div className="w-1.5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full h-full min-h-[48px]" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-0.5 text-xs">
                  Physics
                </Badge>
                <span className="text-xs text-indigo-600 font-medium">Mock Test</span>
              </div>
              <h4 className="text-sm font-bold text-indigo-900">Weekly Assessment</h4>
              <p className="text-xs text-indigo-600 mt-0.5">Today • 7:30 PM • 60 mins</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileWidget({ userStats }: { userStats: any }) {
  return (
    <Card className="rounded-2xl sm:rounded-3xl border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xl">
            T
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Tarun</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white">
                {userStats.rank}
              </Badge>
              <span className="text-xs text-slate-500">Student</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-xl border border-slate-100 text-center shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Solved</div>
            <div className="text-2xl font-black text-slate-900">{userStats.solved}</div>
            <Progress value={75} className="h-1.5 mt-2" />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-xl border border-slate-100 text-center shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Streak</div>
            <div className="text-2xl font-black text-slate-900 flex items-center justify-center gap-1.5">
              {userStats.streak} 
              <Flame size={16} className="text-orange-500 fill-orange-500" />
            </div>
            <p className="text-xs text-slate-500 mt-1">7 days active</p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Weekly Progress</span>
            <span className="text-sm font-bold text-green-600">+12%</span>
          </div>
          <Progress value={65} className="h-2 mt-2" />
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyChallenge() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 p-5 sm:p-6 text-white text-center shadow-xl"
    >
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full translate-y-16 -translate-x-16 blur-3xl" />
      
      <div className="relative z-10">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
          <Trophy size={28} className="text-white" />
        </div>
        
        <h3 className="text-lg sm:text-xl font-bold mb-2">Weekly Championship</h3>
        <p className="text-indigo-100 text-sm mb-6 max-w-xs mx-auto">
          Compete with 10,000+ students. Win exclusive badges & rewards.
        </p>
        
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
            <div className="text-xl font-black">₹10K</div>
            <div className="text-xs text-indigo-200">Prize Pool</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
            <div className="text-xl font-black">4.8★</div>
            <div className="text-xs text-indigo-200">Rating</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
            <div className="text-xl font-black">72</div>
            <div className="text-xs text-indigo-200">Hours Left</div>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full py-3.5 bg-white text-indigo-700 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
        >
          <TrendingUp size={18} />
          Register for Free
        </motion.button>
      </div>
    </motion.div>
  );
}

function SafetyNote() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="rounded-xl sm:rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-4 flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-sm">
        <ShieldCheck className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-blue-900 mb-1">Fair Play & Security</h4>
        <p className="text-xs text-blue-700/90 leading-relaxed">
          Advanced proctoring monitors tab switching. All contests are timed and recorded to ensure a fair competitive environment.
        </p>
      </div>
    </motion.div>
  );
}

export default ContestLandingPage;