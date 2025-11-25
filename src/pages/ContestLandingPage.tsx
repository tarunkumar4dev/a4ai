import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  CheckCircle2,
  BadgeCheck,
  ShieldCheck,
  ArrowLeft,
  TrendingUp,
} from "lucide-react";

// a4ai contexts
import { useCoins } from "@/context/CoinContext";

/* -------------------------------------------
   Theme (tokens here if you want to centralize)
-------------------------------------------- */
const A4 = {
  ink: {
    50: "#f6f8ff",
    100: "#eef2ff",
    200: "#dbe4ff",
    300: "#bfd2ff",
    400: "#9db8ff",
    500: "#6c8ffb",
    600: "#516fde",
    700: "#3e55b1",
    800: "#2f4189",
    900: "#242f63",
  },
  accent: { from: "from-indigo-500", to: "to-blue-600" },
};

/* ---------------------------
   Types
---------------------------- */
interface Contest {
  id: string;
  title: string;
  participants: number;
  duration: string; // "90 min"
  difficulty: "Easy" | "Medium" | "Hard";
  status: "upcoming" | "ongoing" | "completed";
  acceptance: string; // "52.1%"
  startTime: string; // human readable
}

interface Problem {
  id: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  acceptance: string; // show as "Accuracy" in UI
}

/* -------------------------------------------
   Reusable FlashCard (uniform height & style)
-------------------------------------------- */
function FlashCard({
  onClick,
  title,
  subtitle,
  badge,
  cta,
  gradient,
  pattern,
  icon,
  isTrending = false,
}: {
  onClick: () => void;
  title: string;
  subtitle: string;
  badge: string;
  cta: string;
  gradient: string; // e.g. "from-amber-400 via-orange-500 to-amber-600"
  pattern: string; // e.g. "bg-[radial-gradient(...)]"
  icon: React.ReactNode;
  isTrending?: boolean;
}) {
  return (
    <motion.div 
      whileHover={{ y: -6, scale: 1.02 }} 
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative"
    >
      {/* Trending Badge */}
      {isTrending && (
        <div className="absolute -top-2 -right-2 z-20">
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg px-3 py-1 text-xs font-bold">
            <TrendingUp className="h-3 w-3 mr-1" />
            TRENDING
          </Badge>
        </div>
      )}
      
      <Card
        onClick={onClick}
        className={clsx(
          "relative overflow-hidden cursor-pointer rounded-2xl",
          "bg-gradient-to-br text-white shadow-xl border-0 transition-all duration-300",
          "h-[180px] sm:h-[175px] lg:h-[190px]",
          gradient,
          isTrending && "ring-2 ring-yellow-400/60 shadow-2xl" // Enhanced glow for trending
        )}
      >
        {/* Light yellow gradient overlay for trending effect */}
        {isTrending && (
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/15 via-amber-200/10 to-orange-200/5 pointer-events-none" />
        )}
        
        {/* Animated sparkle effect for trending */}
        {isTrending && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full animate-pulse opacity-60"></div>
            <div className="absolute top-6 right-8 w-2 h-2 bg-white rounded-full animate-pulse opacity-40 delay-300"></div>
          </div>
        )}
        
        <CardContent className="h-full p-5 flex flex-col justify-between relative z-10">
          {/* decorative overlay so gradient colors remain visible */}
          <div className={clsx("absolute inset-0 pointer-events-none opacity-25", pattern)} />
          <div className="absolute -right-8 -top-8 opacity-20 rotate-12 pointer-events-none scale-125">
            {icon}
          </div>

          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="font-black text-[15px] leading-tight tracking-tight drop-shadow-md max-w-[70%]">
                {title}
              </h3>
              <Badge 
                variant="secondary" 
                className={clsx(
                  "text-white border-0 font-semibold text-[10px] px-2 py-1",
                  isTrending ? "bg-white/30 backdrop-blur-sm" : "bg-white/20"
                )}
              >
                {badge}
              </Badge>
            </div>
            <p className="text-white/95 text-[11px] leading-relaxed font-medium">{subtitle}</p>
          </div>

          <Button className={clsx(
            "h-9 w-full gap-2 font-bold text-xs transition-all duration-300 transform hover:scale-[1.02]",
            isTrending 
              ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-500 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl border-0 hover:shadow-2xl" 
              : "bg-white text-gray-900 hover:bg-white/95 border-0 shadow-md hover:shadow-lg"
          )}>
            {icon}
            <span className="drop-shadow-sm">{cta}</span>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ---------------------------
   Page
---------------------------- */
const ContestLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { coins } = useCoins();
  const [activeTopic, setActiveTopic] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] =
    useState<"all" | "easy" | "medium" | "hard">("all");

  // Handle back navigation
  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  // mock user (hook later)
  const user = {
    name: "Tarun",
    handle: "a4ai_student",
    solved: 162,
    rating: 1420,
    rank: "Top 20%",
  };

  // A4AI flashcards (Classes 9–12 + JEE/NEET)
  const heroCards = useMemo(
    () => [
      {
        id: 1,
        key: "pyq",
        title: "10 YEAR PYQ'S",
        subtitle: "Boards 2016–2025",
        cta: "Practice Now",
        gradient: "from-amber-500 via-orange-500 to-amber-600",
        badge: "BOARDS",
        icon: <BookOpen className="h-4 w-4" />,
        bgPattern: "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]",
        isTrending: true, // Mark as trending
      },
      {
        id: 2,
        key: "popular",
        title: "MOST POPULAR QUESTIONS",
        subtitle: "Rated by a4ai community",
        cta: "Start Set",
        gradient: "from-pink-500 via-rose-500 to-fuchsia-600",
        badge: "TRENDING",
        icon: <Star className="h-4 w-4" />,
        bgPattern:
          "bg-[radial-gradient(circle_at_20%_0%,_rgba(255,255,255,.3),_transparent_40%)]",
      },
      {
        id: 3,
        key: "hots",
        title: "HOTS",
        subtitle: "High Order Thinking Skills",
        cta: "Solve Now",
        gradient: "from-violet-500 via-purple-500 to-indigo-600",
        badge: "ADVANCED",
        icon: <Zap className="h-4 w-4" />,
        bgPattern:
          "bg-[conic-gradient(from_90deg,_rgba(255,255,255,.15),_transparent_60%)]",
      },
      {
        id: 4,
        key: "repeated",
        title: "MOST REPEATED QUESTIONS",
        subtitle: "High-frequency exam items",
        cta: "Revise",
        gradient: "from-sky-500 via-blue-600 to-indigo-700",
        badge: "REVISION",
        icon: <Award className="h-4 w-4" />,
        bgPattern:
          "bg-[radial-gradient(circle_at_right,_rgba(255,255,255,.25),_transparent_45%)]",
      },
      {
        id: 5,
        key: "jee",
        title: "JEE SPRINT",
        subtitle: "PCM time-boxed drills",
        cta: "Enter Sprint",
        gradient: "from-emerald-500 via-teal-500 to-green-600",
        badge: "JEE",
        icon: <Flame className="h-4 w-4" />,
        bgPattern:
          "bg-[radial-gradient(circle_at_70%_120%,_rgba(255,255,255,.2),_transparent_60%)]",
      },
    ],
    []
  );

  // Topics
  const topics = useMemo(
    () => [
      { name: "All", count: 42 },
      { name: "Class 9", count: 7 },
      { name: "Class 10", count: 8 },
      { name: "Class 11", count: 12 },
      { name: "Class 12", count: 15 },
      { name: "JEE", count: 14 },
      { name: "NEET", count: 10 },
      { name: "Physics", count: 11 },
      { name: "Chemistry", count: 9 },
      { name: "Maths", count: 13 },
      { name: "Biology", count: 6 },
    ],
    []
  );

  const contests: Contest[] = useMemo(
    () => [
      {
        id: "jee-sprint-5",
        title: "JEE Sprint #5 — Mechanics + Algebra",
        participants: 980,
        duration: "60 min",
        difficulty: "Medium",
        status: "upcoming",
        acceptance: "—",
        startTime: "Starts in 2 days",
      },
      {
        id: "neet-bio-drill",
        title: "NEET Biology Drill — Genetics & Evolution",
        participants: 540,
        duration: "45 min",
        difficulty: "Medium",
        status: "upcoming",
        acceptance: "—",
        startTime: "Starts in 4 days",
      },
      {
        id: "cbse-x-physics",
        title: "Class 10 Physics — Light & Electricity",
        participants: 310,
        duration: "40 min",
        difficulty: "Easy",
        status: "ongoing",
        acceptance: "—",
        startTime: "Live · Ends in 32m",
      },
      {
        id: "cbse-xii-chem",
        title: "Class 12 Chemistry — Organic Mix",
        participants: 220,
        duration: "60 min",
        difficulty: "Hard",
        status: "completed",
        acceptance: "52.1%",
        startTime: "Completed · Oct 12",
      },
    ],
    []
  );

  const problems: Problem[] = useMemo(
    () => [
      { id: 1, title: "Gravitation — g at height h", difficulty: "Easy", acceptance: "78%" },
      { id: 2, title: "Chemical Kinetics — rate law", difficulty: "Medium", acceptance: "63%" },
      { id: 3, title: "Vectors — resultant magnitude", difficulty: "Medium", acceptance: "55%" },
      { id: 4, title: "Human Physiology — blood groups", difficulty: "Hard", acceptance: "49%" },
    ],
    []
  );

  // computed
  const filteredContests = contests.filter((c) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch = c.title.toLowerCase().includes(s);
    const matchesDiff =
      difficultyFilter === "all" || c.difficulty.toLowerCase() === difficultyFilter;
    return matchesSearch && matchesDiff;
  });

  const handleContestAction = (contest: Contest) => {
    if (contest.status === "upcoming") navigate(`/contests/preview/${contest.id}`);
    else if (contest.status === "ongoing") navigate(`/contests/live/${contest.id}`);
    else navigate(`/contests/${contest.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30">
      {/* Sticky header bar */}
      <div className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          {/* Left Section - Back Button & Logo */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-white hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 group"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-gray-700 group-hover:text-gray-900 transition-colors" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="text-[16px] font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  a4ai Contest Zone
                </span>
                <p className="text-xs text-gray-500 -mt-1">Practice & Compete</p>
              </div>
            </div>
          </div>

          {/* Center Section - Search & Filters */}
          <div className="flex items-center gap-3 w-full max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search: JEE, NEET, Class 12, Physics…"
                className="pl-10 pr-4 h-10 rounded-xl border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <Button variant="outline" className="gap-2 h-10 rounded-xl border-gray-300 hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 h-10 rounded-xl shadow-md hover:shadow-lg transition-all">
              Host Contest
            </Button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left */}
          <div className="lg:col-span-8 space-y-8">
            {/* Flashcards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {heroCards.map((card) => {
                const map: Record<string, string> = {
                  pyq: "/pyq",
                  popular: "/popular",
                  hots: "/hots",
                  repeated: "/repeated",
                  jee: "/jee-sprint",
                };
                return (
                  <FlashCard
                    key={card.id}
                    onClick={() => navigate(map[card.key as keyof typeof map] || "/")}
                    title={card.title}
                    subtitle={card.subtitle}
                    badge={card.badge}
                    cta={card.cta}
                    gradient={card.gradient}
                    pattern={card.bgPattern}
                    icon={card.icon}
                    isTrending={card.isTrending}
                  />
                );
              })}
            </div>

            {/* Topic chips */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {topics.map((t) => {
                const key = t.name.toLowerCase().replace(/\s+/g, "-");
                const active = activeTopic === key || (activeTopic === "all" && key === "all");
                return (
                  <button
                    key={t.name}
                    onClick={() => {
                      setActiveTopic(key);
                      const routeMap: Record<string, string> = {
                        "class-9": "/question-bank?topic=class9",
                        "class-10": "/question-bank?topic=class10",
                        "class-11": "/question-bank?topic=class11",
                        "class-12": "/question-bank?topic=class12",
                        jee: "/question-bank?topic=jee",
                        neet: "/question-bank?topic=neet",
                        physics: "/question-bank?topic=physics",
                        chemistry: "/question-bank?topic=chemistry",
                        maths: "/question-bank?topic=maths",
                        biology: "/question-bank?topic=biology",
                      };
                      const to = routeMap[key as keyof typeof routeMap];
                      if (to) navigate(to);
                    }}
                    className={clsx(
                      "px-5 py-3 rounded-full border-2 text-sm font-bold whitespace-nowrap transition-all duration-200 snap-start min-w-max",
                      active
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50 shadow-sm hover:shadow-md"
                    )}
                    aria-pressed={active}
                  >
                    {t.name}
                    <span className={clsx("ml-2 font-semibold", active ? "text-white/90" : "text-gray-500")}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tabs */}
            <Card className="border-gray-200/80 shadow-xl rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <Tabs defaultValue="contests" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100/50 p-1 rounded-xl">
                    <TabsTrigger 
                      value="contests" 
                      className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700 font-semibold"
                    >
                      🏆 Contests
                    </TabsTrigger>
                    <TabsTrigger 
                      value="problems" 
                      className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700 font-semibold"
                    >
                      📚 Question Bank
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="contests" className="mt-6">
                    <ContestTable filteredContests={filteredContests} onAction={handleContestAction} />
                  </TabsContent>
                  <TabsContent value="problems" className="mt-6">
                    <ProblemsList problems={problems} onClick={(id) => navigate(`/problems/${id}`)} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <SafetyNote />
          </div>

          {/* Right */}
          <div className="lg:col-span-4 space-y-6">
            <ScheduleBanner />
            <CoinsCard coins={coins} onShop={() => navigate("/coinshop")} />
            <StudentProfileCard user={user} />
            <MissionCard />
            <BadgesCard />
            <WeeklyContestCard />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------
   Sub-components
---------------------------- */
function ContestTable({
  filteredContests,
  onAction,
}: {
  filteredContests: Contest[];
  onAction: (c: Contest) => void;
}) {
  return (
    <Card className="border-gray-200/80 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b">
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Featured Contests
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-12 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100/30 border-b border-gray-200 text-sm font-bold text-gray-700">
          <div className="col-span-6">Title</div>
          <div className="col-span-2 text-center">Participants</div>
          <div className="col-span-2 text-center">Duration</div>
          <div className="col-span-1 text-center">Diff</div>
          <div className="col-span-1 text-center">Action</div>
        </div>

        <div className="divide-y divide-gray-100/80">
          <AnimatePresence>
            {filteredContests.map((contest, index) => (
              <motion.div
                key={contest.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <div
                  className="grid grid-cols-12 px-6 py-5 min-h-[72px] items-center hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/20 cursor-pointer transition-all duration-200 group"
                  onClick={() => onAction(contest)}
                >
                  <div className="col-span-6">
                    <div className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                      {contest.title}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{contest.startTime}</span>
                      {contest.status === "ongoing" && (
                        <Badge className="bg-red-500 text-white text-[10px] px-2 py-1 font-bold animate-pulse">
                          🔴 LIVE
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-center text-sm text-gray-700">
                    <div className="flex items-center justify-center gap-1 font-semibold">
                      <Users className="h-4 w-4 text-blue-500" />
                      {contest.participants.toLocaleString()}
                    </div>
                  </div>

                  <div className="col-span-2 text-center text-sm text-gray-700 font-medium">
                    {contest.duration}
                  </div>

                  <div className="col-span-1 text-center">
                    <Badge
                      className={clsx(
                        "text-xs font-bold px-2 py-1 border-0",
                        contest.difficulty === "Easy" && "bg-green-500/15 text-green-700",
                        contest.difficulty === "Medium" && "bg-yellow-500/15 text-yellow-700",
                        contest.difficulty === "Hard" && "bg-red-500/15 text-red-700"
                      )}
                    >
                      {contest.difficulty}
                    </Badge>
                  </div>

                  <div className="col-span-1 text-center">
                    <Button
                      size="sm"
                      variant={
                        contest.status === "ongoing" ? "default" : contest.status === "upcoming" ? "outline" : "ghost"
                      }
                      className={clsx(
                        contest.status === "ongoing" && "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg",
                        contest.status === "upcoming" && "border-indigo-200 text-indigo-700 hover:bg-indigo-50",
                        "text-xs font-bold transition-all duration-200"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(contest);
                      }}
                    >
                      {contest.status === "upcoming" ? "Preview" : contest.status === "ongoing" ? "Join Now" : "Details"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

function ProblemsList({ problems, onClick }: { problems: Problem[]; onClick: (id: number) => void }) {
  return (
    <Card className="border-gray-200/80 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b">
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-500" />
          Practice Sets
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b border-gray-200">
          <div className="grid grid-cols-12 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100/30 text-sm font-bold text-gray-700">
            <div className="col-span-8">Title</div>
            <div className="col-span-2 text-center">Accuracy</div>
            <div className="col-span-2 text-center">Difficulty</div>
          </div>
        </div>

        <div className="divide-y divide-gray-100/80">
          {problems.map((p, index) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="grid grid-cols-12 px-6 py-4 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/20 text-left transition-all duration-200 group"
              onClick={() => onClick(p.id)}
            >
              <div className="col-span-8">
                <div className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  {p.id}. {p.title}
                </div>
              </div>
              <div className="col-span-2 text-center text-sm font-medium text-gray-600">{p.acceptance}</div>
              <div className="col-span-2 text-center">
                <Badge
                  className={clsx(
                    "text-xs font-bold px-2 py-1 border-0",
                    p.difficulty === "Easy" && "bg-green-500/15 text-green-700",
                    p.difficulty === "Medium" && "bg-yellow-500/15 text-yellow-700",
                    p.difficulty === "Hard" && "bg-red-500/15 text-red-700"
                  )}
                >
                  {p.difficulty}
                </Badge>
              </div>
            </motion.button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleBanner() {
  return (
    <Card className="border-gray-200/80 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-blue-50/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Calendar
          </h3>
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
        </div>
        <MiniCalendar />
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-200/50">
          <div className="text-sm font-semibold text-blue-800">Next: Weekly Contest</div>
          <div className="text-xs text-blue-600">Sunday 7:30 PM</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoinsCard({ coins, onShop }: { coins: number; onShop: () => void }) {
  return (
    <Card className="border-amber-200/80 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-2xl">🪙</span>
          </div>
          <div>
            <div className="text-3xl font-black text-gray-900">{coins.toLocaleString()}</div>
            <div className="text-sm text-amber-700 font-semibold">Available Coins</div>
          </div>
        </div>

        <div className="space-y-3 text-sm mb-5">
          <Row label="Contest Join:" value="+50 coins" />
          <Row label="Top 3 Finish:" value="+200–500 coins" />
          <Row label="Daily Streak:" value="+100 coins" />
        </div>

        <Button
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 h-11 rounded-xl"
          onClick={onShop}
        >
          🛍️ Visit Reward Store
        </Button>
        <div className="mt-3 text-center text-xs text-amber-700 font-medium">
          Amazon • Flipkart • AJIO • Swiggy • Netflix
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-amber-800 font-medium">{label}</span>
      <span className="font-black text-green-600 bg-green-500/10 px-2 py-1 rounded-lg">{value}</span>
    </div>
  );
}

function StudentProfileCard({
  user,
}: {
  user: { name: string; handle: string; solved: number; rating: number; rank: string };
}) {
  return (
    <Card className="border-gray-200/80 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-indigo-50/50">
      <CardContent className="p-6">
        <div className="text-center mb-5">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center text-white font-black text-2xl mx-auto mb-4 shadow-lg">
            {user.name[0]}
          </div>
          <h3 className="font-bold text-gray-900 text-lg">{user.name}</h3>
          <p className="text-sm text-gray-600 font-medium">@{user.handle}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <MiniStat label="Solved" value={user.solved} />
          <MiniStat label="Rating" value={user.rating} />
          <MiniStat label="Rank" value={user.rank} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white/50 rounded-xl p-3 shadow-sm border border-gray-200/50">
      <div className="text-lg font-black text-gray-900">{value}</div>
      <div className="text-xs text-gray-600 font-semibold">{label}</div>
    </div>
  );
}

function WeeklyContestCard() {
  return (
    <Card className="border-blue-200/80 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <Trophy className="h-8 w-8 text-blue-600" />
          <div>
            <div className="font-bold text-gray-900">a4ai Weekly — JEE Mock</div>
            <div className="text-sm text-blue-600 font-semibold">Starts in 2 days</div>
          </div>
        </div>
        <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold shadow-lg hover:shadow-xl transition-all h-11 rounded-xl">
          🚀 Register Now
        </Button>
      </CardContent>
    </Card>
  );
}

// Mini Calendar
function MiniCalendar() {
  const today = new Date();
  const days = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="space-y-3 select-none">
      <div className="grid grid-cols-7 gap-1 text-xs font-bold text-gray-500">
        {days.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => {
          const day = i - 2;
          const isCurrentMonth = day > 0 && day <= 31;
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <div
              key={i}
              className={clsx(
                "h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200 cursor-pointer",
                isCurrentMonth
                  ? isToday
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 font-bold"
                    : "bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200/80 hover:border-blue-300"
                  : "bg-transparent text-gray-300"
              )}
            >
              {isCurrentMonth ? day : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionCard() {
  return (
    <Card className="border-indigo-200/80 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-purple-50/50">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <h3 className="font-bold text-gray-900 text-lg">Daily Missions</h3>
        </div>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3 p-2 bg-white/50 rounded-lg border border-gray-200/50">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" /> 
            <span className="font-medium">Solve 3 Easy sets</span>
            <Badge className="ml-auto bg-green-500/15 text-green-700 border-0 font-bold">+30 coins</Badge>
          </li>
          <li className="flex items-center gap-3 p-2 bg-white/50 rounded-lg border border-gray-200/50">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" /> 
            <span className="font-medium">Join 1 live contest</span>
            <Badge className="ml-auto bg-green-500/15 text-green-700 border-0 font-bold">+50 coins</Badge>
          </li>
          <li className="flex items-center gap-3 p-2 bg-white/50 rounded-lg border border-gray-200/50">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" /> 
            <span className="font-medium">Review 1 past attempt</span>
            <Badge className="ml-auto bg-green-500/15 text-green-700 border-0 font-bold">+15 coins</Badge>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function BadgesCard() {
  return (
    <Card className="border-amber-200/80 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-amber-50/50">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BadgeCheck className="h-6 w-6 text-amber-600" />
          <h3 className="font-bold text-gray-900 text-lg">Badges</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-3 rounded-xl text-center shadow-lg">
            <div className="text-xs font-bold">Speedster</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-3 rounded-xl text-center shadow-lg">
            <div className="text-xs font-bold">Top 20%</div>
          </div>
          <div className="bg-gradient-to-br from-sky-500 to-blue-500 text-white p-3 rounded-xl text-center shadow-lg">
            <div className="text-xs font-bold">Scholar</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white p-3 rounded-xl text-center shadow-lg">
            <div className="text-xs font-bold">Fast Thinker</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SafetyNote() {
  return (
    <Card className="border-dashed border-2 border-blue-300/50 shadow-lg rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
      <CardContent className="p-5 flex items-start gap-4">
        <ShieldCheck className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-bold text-blue-900 text-lg mb-2">Fair Play & Privacy</div>
          <div className="text-blue-800/80 text-sm leading-relaxed">
            Smart proctoring, tab-switch detection, and camera checks only during live rounds (never
            stored without consent). Your privacy is our priority.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ContestLandingPage;