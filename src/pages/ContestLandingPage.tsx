import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

// shadcn/ui generic components (Simulated)
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// icons - FlaskConical added
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
  FlaskConical // 🔥 FlaskConical added
} from "lucide-react";

// a4ai contexts
import { useCoins } from "@/context/CoinContext";

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

/* -------------------------------------------
   Premium Bento FlashCard (Responsive)
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
}) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      className="relative h-full w-full"
    >
      <div
        onClick={onClick}
        className={clsx(
          "group relative overflow-hidden rounded-[24px] h-[180px] sm:h-[200px] cursor-pointer transition-all duration-300",
          "shadow-[0_4px_20px_-12px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.2)]",
          gradient
        )}
      >
        {/* Abstract Texture */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none" />
        
        {/* Top Right Icon */}
        <div className="absolute top-4 right-4 z-20">
             <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-sm">
                {icon}
             </div>
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-5 sm:p-6">
          
          <div className="space-y-2 sm:space-y-3">
             {/* Badge */}
             {(isTrending || isPopular) ? (
                <div className={clsx(
                   "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md border border-white/20",
                   isTrending ? "bg-black/20 text-white" : "bg-purple-400/20 text-purple-50"
                )}>
                   {isTrending ? <Flame size={12} className="fill-current" /> : <Crown size={12} className="fill-current" />}
                   {isTrending ? "Trending" : "Top Pick"}
                </div>
             ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/90 border border-white/10">
                   {badge}
                </div>
             )}

             <div className="pr-8"> 
                <h3 className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight drop-shadow-sm line-clamp-2">
                   {title}
                </h3>
                <p className="text-white/80 text-xs font-medium mt-1 line-clamp-1">
                   {subtitle}
                </p>
             </div>
          </div>

          <div className="pt-2">
             <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/95 text-slate-900 text-xs font-bold hover:bg-white transition-colors shadow-lg active:scale-[0.99]">
                <span>{cta}</span>
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                   <ChevronRight size={12} className="text-slate-600" />
                </div>
             </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------
   Main Page
---------------------------- */
const ContestLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { coins } = useCoins();
  const [activeTopic, setActiveTopic] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");

  const handleBack = () => navigate(-1);
  const handleDashboardClick = () => navigate("/dashboard");

  // Subject mapping for practice sessions
  const subjectMap = {
    '10': 'Science',
    '12': 'Physics',
    'JEE': 'Physics',
    'NEET': 'Biology'
  };

  // Handle practice card click - FIXED
  const handleStartPractice = (className: string) => {
    const subject = subjectMap[className as keyof typeof subjectMap];
    console.log('🚀 Navigating to practice session:', { 
      className, 
      subject,
      path: `/practice/session?class=${className}&subject=${subject}`
    });
    navigate(`/practice/session?class=${className}&subject=${subject}`);
  };

  // Mock Data
  const user = { name: "Tarun", handle: "a4ai_student", solved: 162, rating: 1420, rank: "Top 20%", streak: 7 };

  const heroCards = useMemo(() => [
    { 
      id: 1, 
      key: "pyq", 
      title: "10 Year PYQ's", 
      subtitle: "Boards 2016–2025", 
      cta: "Practice", 
      gradient: "bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600",
      badge: "Boards", 
      icon: <BookOpen className="h-5 w-5" />, 
      isTrending: true 
    },
    // CHANGED: Daily Practice Card - Now supports class selection
    { 
      id: 2, 
      key: "practice", 
      title: "Daily Practice", 
      subtitle: "5 Questions • Earn Coins", 
      cta: "Start Practice", 
      gradient: "bg-gradient-to-br from-green-500 to-emerald-600", 
      badge: "New", 
      icon: <Award className="h-5 w-5" />, 
      isPopular: true 
    },
    // NEW: Chemistry Card
    { 
      id: 3, 
      key: "chemistry", 
      title: "Chemistry Practice", 
      subtitle: "Reactions & Formulas", 
      cta: "Learn Now", 
      gradient: "bg-gradient-to-br from-blue-500 to-indigo-600", 
      badge: "Science", 
      icon: <FlaskConical className="h-5 w-5" /> 
    },
    { 
      id: 4, 
      key: "hots", 
      title: "HOTS Challenge", 
      subtitle: "Advanced Thinking", 
      cta: "Solve", 
      gradient: "bg-gradient-to-br from-violet-500 to-indigo-600", 
      badge: "Hard", 
      icon: <Zap className="h-5 w-5" /> 
    },
    { 
      id: 5, 
      key: "jee", 
      title: "JEE Sprint", 
      subtitle: "Speed Drills", 
      cta: "Enter Sprint", 
      gradient: "bg-gradient-to-br from-emerald-400 to-teal-600", 
      badge: "Entrance", 
      icon: <Flame className="h-5 w-5" /> 
    },
  ], []);

  const topics = useMemo(() => [
    { name: "All", count: 42, icon: <LayoutGrid size={14} /> },
    { name: "Class 10", count: 8, icon: "🔟" },
    { name: "Class 11", count: 12, icon: "1️⃣1️⃣" },
    { name: "Class 12", count: 15, icon: "1️⃣2️⃣" },
    { name: "JEE", count: 14, icon: "⚛️" },
    { name: "NEET", count: 10, icon: "🧬" },
    { name: "Physics", count: 11, icon: "⚡" },
    { name: "Chemistry", count: 9, icon: "🧪" },
    { name: "Maths", count: 13, icon: "📐" },
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

  const handleContestAction = (contest: Contest) => {
    if (contest.status === "upcoming") navigate(`/contests/preview/${contest.id}`);
    else if (contest.status === "ongoing") navigate(`/contests/live/${contest.id}`);
    else navigate(`/contests/${contest.id}`);
  };

  // Handle card clicks - UPDATED with Chemistry
  const handleCardClick = (cardKey: string) => {
    console.log('📱 Card clicked:', cardKey);
    
    if (cardKey === "practice") {
      // Show class selection prompt
      console.log('🎯 Opening practice class selection...');
      const selectedClass = prompt("Select your class: 10, 12, JEE, or NEET");
      if (selectedClass && subjectMap[selectedClass as keyof typeof subjectMap]) {
        handleStartPractice(selectedClass);
      } else if (selectedClass) {
        alert("Invalid class selection. Please choose from: 10, 12, JEE, or NEET");
      }
    } else if (cardKey === "chemistry") {
      // Navigate to Chemistry Practice Page
      console.log('🧪 Opening Chemistry practice...');
      navigate('/practice/chemistry');
    } else {
      // Existing logic for other cards
      console.log(`Clicked ${cardKey} card`);
      // You can add navigation for other cards here if needed
      // For example:
      // if (cardKey === "pyq") navigate("/pyq");
      // if (cardKey === "hots") navigate("/hots");
      // if (cardKey === "jee") navigate("/jee");
    }
  };

  return (
    // Background: Clean Alabaster with subtle noise for texture
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-indigo-500/20 selection:text-indigo-800 pb-20">
      
      {/* --------------------------------------
          Header: Responsive & Sticky
      --------------------------------------- */}
      <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[64px] sm:h-[72px] flex items-center justify-between gap-2">
            
            {/* Left: Branding & Back */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <button
                onClick={handleBack}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
              </button>

              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                 <img 
                    src="/images/LOGO.png" 
                    alt="a4ai Logo" 
                    className="h-7 sm:h-8 w-auto object-contain" 
                 />
                 <div className="hidden sm:block">
                    <h1 className="text-lg font-bold tracking-tight text-slate-900">a4ai <span className="text-indigo-600">Contest Zone</span></h1>
                 </div>
              </div>
            </div>

            {/* Center: Search (Desktop) */}
            <div className="hidden md:flex flex-1 max-w-xl px-4">
              <div className="relative w-full group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contests, topics..."
                  className="pl-10 h-10 rounded-full bg-slate-100/80 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            {/* Right: Coins & Profile */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              
              {/* Mobile Search Toggle */}
              <button 
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              >
                {isMobileSearchOpen ? <X size={20} /> : <Search size={20} />}
              </button>

              {/* Coin Balance (Compact on Mobile) */}
              <div 
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100/50 cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={() => navigate('/coinshop')}
              >
                  <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px] shadow-sm">🪙</div>
                  <span className="font-bold text-amber-700 text-sm">{coins.toLocaleString()}</span>
              </div>

              {/* User Profile */}
              <div 
                onClick={handleDashboardClick}
                className="flex items-center gap-2.5 pl-1 pr-1 sm:pr-3 py-1 rounded-full border border-slate-100 hover:bg-slate-50 hover:border-slate-200 cursor-pointer transition-all active:scale-95"
              >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                    {user.name[0]}
                  </div>
                  <span className="text-sm font-bold text-slate-700 hidden sm:block">{user.name}</span>
              </div>
            </div>
          </div>

          {/* Mobile Search Bar (Dropdown) */}
          <AnimatePresence>
            {isMobileSearchOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden overflow-hidden pb-4"
              >
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contests..."
                  autoFocus
                  className="w-full h-10 rounded-xl bg-slate-100/80 border-transparent focus:bg-white"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* --------------------------------------
          Main Content
      --------------------------------------- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 sm:space-y-10">
        
        {/* 1. Welcome Section (Responsive Stack) */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
           <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                 Ready to Compete, <br className="sm:hidden" />
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">{user.name}?</span>
              </h1>
              <p className="text-slate-500 mt-1.5 font-medium text-sm sm:text-base">
                Your <span className="text-amber-500 font-bold">{user.streak} day streak</span> is active. Keep it up!
              </p>
           </div>
           
           {/* Quick Stats Grid */}
           <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
                 <Trophy size={14} className="text-yellow-500" />
                 <span className="text-xs sm:text-sm font-bold text-slate-700">{user.rank}</span>
              </div>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
                 <Star size={14} className="text-indigo-500" />
                 <span className="text-xs sm:text-sm font-bold text-slate-700">{user.rating}</span>
              </div>
           </div>
        </section>

        {/* 2. Hero FlashCards - 1 Column on Mobile */}
        <section>
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                 <Sparkles size={18} className="text-indigo-500" /> Featured Sets
              </h2>
           </div>
           {/* Grid changes from 1 (mobile) to 5 (desktop) */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
              {heroCards.map((card) => (
                 <PremiumFlashCard 
                    key={card.id} 
                    {...card} 
                    onClick={() => handleCardClick(card.key)} 
                 />
              ))}
           </div>
        </section>

        {/* 3. Main Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Column (Content) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Topic Pills (Horizontal Scroll) */}
            <div>
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Browse Topics</h3>
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  {topics.map((topic) => {
                     const key = topic.name.toLowerCase();
                     const active = activeTopic === key;
                     return (
                        <button
                           key={topic.name}
                           onClick={() => setActiveTopic(key)}
                           className={clsx(
                              "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 border",
                              active 
                                 ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                                 : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                           )}
                        >
                           <span className="text-base">{topic.icon}</span>
                           {topic.name}
                           {active && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] ml-1">{topic.count}</span>}
                        </button>
                     );
                  })}
               </div>
            </div>

            {/* Modern Tabbed Content */}
            <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
               <Tabs defaultValue="contests" className="w-full">
                  <div className="border-b border-slate-100 bg-slate-50/50 px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
                     <TabsList className="bg-slate-200/50 p-1 rounded-xl sm:rounded-2xl w-full sm:w-fit flex h-12">
                        <TabsTrigger value="contests" className="flex-1 sm:flex-none rounded-lg sm:rounded-xl px-4 sm:px-6 h-10 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                           Live Contests
                        </TabsTrigger>
                        <TabsTrigger value="problems" className="flex-1 sm:flex-none rounded-lg sm:rounded-xl px-4 sm:px-6 h-10 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
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
                            <div className="p-10 text-center text-slate-400 font-medium">No contests found.</div>
                        )}
                     </div>
                  </TabsContent>

                  <TabsContent value="problems" className="p-0 m-0">
                     <div className="divide-y divide-slate-100">
                        {problems.map((p, i) => (
                           <ProblemRow key={p.id} data={p} onClick={() => {}} index={i} />
                        ))}
                     </div>
                  </TabsContent>
               </Tabs>
            </div>
            
            <SafetyNote />
          </div>

          {/* Right Column (Widgets) - Hidden on tiny screens if desired, but kept for responsiveness */}
          <div className="lg:col-span-4 space-y-6">
            <CoinsCard coins={coins} />
            <ScheduleWidget />
            <div className="hidden lg:block"><ProfileWidget user={user} /></div>
            <WeeklyChallenge />
          </div>

        </div>
      </div>
    </div>
  );
};

/* ---------------------------
   Refined Sub-Components (Fully Responsive)
---------------------------- */

function ContestRow({ data, onAction, index }: { data: Contest, onAction: any, index: number }) {
  const isOngoing = data.status === "ongoing";
  return (
     <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => onAction(data)}
        // Responsive Layout: Flex Column on Mobile, Row on Desktop
        className={clsx(
           "p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer group border-l-4 border-transparent relative overflow-hidden",
           isOngoing && "hover:border-l-indigo-500 bg-indigo-50/30"
        )}
     >
        <div className="flex w-full sm:w-auto items-start gap-4">
            {/* Icon */}
            <div className={clsx(
                "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex shrink-0 items-center justify-center text-lg sm:text-xl shadow-sm",
                isOngoing ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-100 text-slate-500"
            )}>
                {isOngoing ? <Zap size={20} className="fill-current" /> : <Calendar size={20} />}
            </div>

            {/* Mobile Title View */}
            <div className="sm:hidden flex-1">
                 <div className="flex items-center gap-2 mb-1">
                    {isOngoing && <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">Live</span>}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{data.difficulty}</span>
                 </div>
                 <h4 className="text-sm font-bold text-slate-900 leading-tight">{data.title}</h4>
            </div>
        </div>

        {/* Desktop Content & Details */}
        <div className="flex-1 w-full sm:text-left pl-14 sm:pl-0 -mt-2 sm:mt-0">
           <div className="hidden sm:flex items-center gap-2 mb-1">
              {isOngoing && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">Live</span>}
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{data.difficulty}</span>
           </div>
           <h4 className="hidden sm:block text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{data.title}</h4>
           
           <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md sm:bg-transparent sm:p-0"><Clock size={12} /> {data.startTime}</span>
              <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md sm:bg-transparent sm:p-0"><Users size={12} /> {data.participants}</span>
           </div>
        </div>

        {/* Action Button */}
        <div className="w-full sm:w-auto pl-14 sm:pl-0">
             <Button 
                size="sm" 
                className={clsx(
                    "rounded-xl font-bold px-6 h-9 sm:h-10 w-full sm:w-auto shadow-sm transition-all text-xs sm:text-sm",
                    isOngoing 
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200" 
                        : "bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
                )}
                >
                {isOngoing ? "Join Now" : "Details"}
            </Button>
        </div>
     </motion.div>
  )
}

function ProblemRow({ data, onClick, index }: { data: Problem, onClick: any, index: number }) {
   return (
      <div onClick={onClick} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 cursor-pointer group">
         <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex shrink-0 items-center justify-center text-slate-400 font-bold text-[10px] sm:text-xs group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
               #{data.id}
            </div>
            <div>
               <h4 className="font-semibold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-700 line-clamp-1">{data.title}</h4>
               <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 font-normal h-5 px-1.5">{data.difficulty}</Badge>
                  <span className="text-[10px] text-slate-400 flex items-center">Acc: {data.acceptance}</span>
               </div>
            </div>
         </div>
         <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500" />
      </div>
   )
}

function CoinsCard({ coins }: { coins: number }) {
   return (
     <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white shadow-xl shadow-orange-200">
       <div className="relative z-10">
         <div className="flex items-center justify-between mb-6 sm:mb-8">
           <div className="flex flex-col">
             <span className="text-amber-100 text-xs font-bold uppercase tracking-widest">Balance</span>
             <span className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
               {coins.toLocaleString()} <span className="text-2xl opacity-60">©</span>
             </span>
           </div>
           <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
             <Sparkles className="text-white fill-white" size={20} />
           </div>
         </div>
         <button className="w-full bg-white text-orange-600 font-bold h-10 sm:h-12 rounded-xl sm:rounded-2xl shadow-lg hover:bg-orange-50 transition-colors text-sm sm:text-base">
            Redeem Rewards
         </button>
       </div>
       {/* Decorative Circles */}
       <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
       <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-600/20 rounded-full blur-xl" />
     </div>
   )
 }

function ScheduleWidget() {
   return (
      <Card className="rounded-[24px] sm:rounded-[32px] border-slate-200 shadow-sm overflow-hidden">
         <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
               <Calendar size={20} className="text-indigo-600" />
               <h3 className="font-bold text-slate-900">Study Calendar</h3>
            </div>
            {/* Simple Date Strip */}
            <div className="flex justify-between mb-6">
               {['S','M','T','W','T','F','S'].map((d,i) => (
                  <div key={i} className={clsx("flex flex-col items-center gap-2", i===3 ? "text-indigo-600" : "text-slate-400")}>
                     <span className="text-[10px] sm:text-xs font-bold">{d}</span>
                     <div className={clsx("w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold", i===3 ? "bg-indigo-600 text-white shadow-md" : "hover:bg-slate-100")}>
                        {14+i}
                     </div>
                  </div>
               ))}
            </div>
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
               <div className="flex gap-3">
                  <div className="w-1 bg-indigo-500 rounded-full h-full min-h-[40px]" />
                  <div>
                     <h4 className="text-sm font-bold text-indigo-900">Physics Mock Test</h4>
                     <p className="text-xs text-indigo-600 mt-0.5">Today • 7:30 PM</p>
                  </div>
               </div>
            </div>
         </CardContent>
      </Card>
   )
}

function ProfileWidget({ user }: { user: any }) {
   return (
      <Card className="rounded-[32px] border-slate-200 shadow-sm">
         <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
               <div className="w-16 h-16 rounded-full bg-slate-100 border-4 border-white shadow-sm flex items-center justify-center text-xl font-bold text-slate-500">
                  {user.name[0]}
               </div>
               <div>
                  <h3 className="font-bold text-lg text-slate-900">{user.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                     <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">{user.rank}</Badge>
                  </div>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase">Solved</div>
                  <div className="text-xl font-black text-slate-900">{user.solved}</div>
               </div>
               <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase">Streak</div>
                  <div className="text-xl font-black text-slate-900 flex items-center justify-center gap-1">
                     {user.streak} <Flame size={14} className="text-orange-500 fill-orange-500" />
                  </div>
               </div>
            </div>
         </CardContent>
      </Card>
   )
}

function WeeklyChallenge() {
   return (
      <div className="rounded-[24px] sm:rounded-[32px] bg-gradient-to-br from-indigo-600 to-blue-700 p-6 text-white text-center shadow-xl shadow-indigo-200">
         <Trophy size={40} className="mx-auto mb-4 text-yellow-300" />
         <h3 className="text-lg font-bold">Weekly Championship</h3>
         <p className="text-indigo-100 text-sm mt-2 mb-6">Compete with 10k+ students and win premium rewards.</p>
         <button className="w-full py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:scale-105 transition-transform text-sm sm:text-base">
            Register for Free
         </button>
      </div>
   )
}

function SafetyNote() {
   return (
     <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4 flex items-start gap-3 sm:gap-4">
       <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
         <ShieldCheck className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
       </div>
       <div>
         <h4 className="text-sm font-bold text-blue-900">Fair Play Enabled</h4>
         <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
           Smart proctoring monitors tab switching during live contests to ensure a fair environment.
         </p>
       </div>
     </div>
   );
 }

export default ContestLandingPage;