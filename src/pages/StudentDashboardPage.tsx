// src/pages/StudentDashboardPage.tsx
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  lazy,
  Suspense,
  memo,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionTemplate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";

import DashboardSidebar from "@/components/DashboardSidebar";
// ScratchCard only shows conditionally → lazy-load to save initial bytes & paint time.
const ScratchCard = lazy(() => import("@/components/ScratchCard"));

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BellDot,
  Flame,
  Rocket,
  TimerReset,
  TrendingUp,
  FileText,
  Zap,
  Coins,
  Menu,
  ArrowLeft,
  BookOpen,
  School,
  BarChart3,
  Clock,
  Users,
  Target,
  Award,
  Brain,
  // New icons for Practice Zone
  BookMarked,
  Target as TargetIcon,
  Layers,
  ChevronRight,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Star,
  Trophy,
  GraduationCap,
  Calculator,
  Atom,
  Beaker,
  FlaskConical,
  History,
  Sparkles,
  Zap as ZapIcon,
  Filter,
  Search,
  Download,
  Share2,
  Eye,
  Edit,
  MoreVertical,
  RefreshCw,
  TrendingUp as TrendingUpIcon,
  ActivitySquare,
  BrainCircuit,
  LineChart,
  PieChart,
  ChartLine,
  ChartBar,
  Target as TargetIcon2,
  Award as AwardIcon,
  Book,
  TestTube,
  Globe,
  Calendar,
  Clock as ClockIcon,
  BarChart4,
  Activity,
  Shield,
  CheckCheck,
  AlertCircle,
  Lightbulb,
  RotateCw,
  SkipForward,
  SkipBack,
  FastForward,
  Rewind,
  HelpCircle,
  Settings,
  User,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  EyeOff,
  Eye as EyeIcon,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ShieldQuestion,
  // NEW IMPORT for Daily Practice tab
  Target as TargetPracticeIcon,
} from "lucide-react";

// Import Practice API
import { pyqAPI } from "@/lib/api/pyq";

// Color Palette
const A4AI_COLORS = {
  primary: "#1a237e",
  secondary: "#283593",
  accent: "#5c6bc0",
  accent2: "#3949ab",
  background: "#f8fafc",
  card: "#ffffff",
  surface: "#f1f5f9",
  text: "#1e293b",
  muted: "#64748b",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  border: "#e2e8f0",
  highlight: "#eff6ff",
};

/* ------------ tiny media hook (stable) ------------ */
function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    h();
    try {
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    } catch {
      mq.addListener(h);
      return () => mq.removeListener(h);
    }
  }, [q]);
  return m;
}
const useIsMobile = () => useMedia("(max-width: 768px)");
const useCoarse = () => useMedia("(pointer: coarse)");

/* ------------ animations (constants) ------------ */
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.06 } },
} as const;
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28 } },
} as const;

/* ------------ brand ink/slate for headings/body ------------ */
const INK = "#2F3A44";
const SLATE = "#5D6B7B";

/** rAF-based throttler to keep mousemove ultra-cheap */
function useRafThrottle<T extends (...args: any[]) => void>(fn: T) {
  const frame = useRef<number | null>(null);
  const lastArgs = useRef<any[]>([]);
  const cb = useCallback((...args: any[]) => {
    lastArgs.current = args;
    if (frame.current == null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        fn(...lastArgs.current);
      });
    }
  }, [fn]);
  useEffect(() => () => frame.current != null && cancelAnimationFrame(frame.current), []);
  return cb as T;
}

/** safe localStorage read/write (won't throw under SSR/private mode) */
const safeStorage = {
  get(key: string) {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    } catch {
      /* no-op */
    }
  },
};

// Practice Zone Stats Interface
interface PracticeZoneStats {
  classLevel: 10 | 12;
  subjects: string[];
  selectedSubject: string;
  chapters: string[];
  selectedChapter: string;
  chapterProgress: {
    completion_percentage: number;
    correct: number;
    coins_earned: number;
    total_questions: number;
  };
  recentActivity: Array<{
    id: string;
    subject: string;
    chapter: string;
    correct: number;
    total: number;
    date: string;
    coins_earned: number;
  }>;
  leaderboard: Array<{
    rank: number;
    name: string;
    score: number;
    coins: number;
  }>;
}

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  const [activeTab, setActiveTab] = useState("overview");

  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const isCoarse = useCoarse();
  const interactiveCards = !(isMobile || isCoarse || prefersReducedMotion);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  // Practice Zone State
  const [practiceZoneStats, setPracticeZoneStats] = useState<PracticeZoneStats>({
    classLevel: 10,
    subjects: [],
    selectedSubject: '',
    chapters: [],
    selectedChapter: '',
    chapterProgress: {
      completion_percentage: 0,
      correct: 0,
      coins_earned: 0,
      total_questions: 0
    },
    recentActivity: [],
    leaderboard: []
  });
  const [practiceLoading, setPracticeLoading] = useState(false);

  // Scratch Card State
  const [showScratchCard, setShowScratchCard] = useState(false);
  const closeScratch = useCallback(() => {
    setShowScratchCard(false);
    safeStorage.set("hasSeenCoinPopup", "true");
  }, []);
  const popupTimers = useRef<number[]>([]);

  /** Check if new user and show coins popup */
  useEffect(() => {
    if (loading || !profile) return;

    const isNewUser = searchParams.get("newUser") === "true";
    const storedHasSeenPopup = safeStorage.get("hasSeenCoinPopup");
    const shouldShowForCoins = !!profile?.coins && profile.coins >= 100 && !storedHasSeenPopup;
    const shouldShowForNewUser = isNewUser && !storedHasSeenPopup;

    const ids: number[] = [];
    if (shouldShowForCoins) {
      ids.push(
        window.setTimeout(() => setShowScratchCard(true), 1500)
      );
    }
    if (shouldShowForNewUser) {
      ids.push(
        window.setTimeout(() => setShowScratchCard(true), 2000)
      );
    }

    popupTimers.current = ids;
    return () => {
      popupTimers.current.forEach((id) => clearTimeout(id));
      popupTimers.current = [];
    };
  }, [loading, profile?.id, profile?.coins, searchParams.get("newUser")]);

  // Load practice zone data
  useEffect(() => {
    if (profile && activeTab === "practice") {
      loadPracticeZoneData();
    }
  }, [profile, activeTab]);

  const loadPracticeZoneData = async () => {
    if (!profile) return;
    
    setPracticeLoading(true);
    try {
      // Load subjects
      const subjects = await pyqAPI.getSubjects(10);
      const selectedSubject = subjects[0] || '';
      
      // Load chapters for selected subject
      let chapters: string[] = [];
      if (selectedSubject) {
        chapters = await pyqAPI.getChapters(10, selectedSubject);
      }
      
      // Load chapter progress
      let chapterProgress = {
        completion_percentage: 0,
        correct: 0,
        coins_earned: 0,
        total_questions: 0
      };
      
      if (selectedSubject && chapters.length > 0) {
        const selectedChapter = chapters[0];
        const progress = await pyqAPI.getUserProgress(
          profile.id,
          10,
          selectedSubject,
          selectedChapter
        );
        chapterProgress = progress;
      }

      // Mock recent activity and leaderboard
      const recentActivity = [
        {
          id: '1',
          subject: 'Mathematics',
          chapter: 'Real Numbers',
          correct: 8,
          total: 10,
          date: '2 hours ago',
          coins_earned: 15
        },
        {
          id: '2',
          subject: 'Science',
          chapter: 'Chemical Reactions',
          correct: 6,
          total: 10,
          date: '1 day ago',
          coins_earned: 12
        },
        {
          id: '3',
          subject: 'Mathematics',
          chapter: 'Polynomials',
          correct: 9,
          total: 10,
          date: '3 days ago',
          coins_earned: 18
        }
      ];

      const leaderboard = [
        { rank: 1, name: 'Sarah Johnson', score: 245, coins: 1200 },
        { rank: 2, name: 'Michael Chen', score: 220, coins: 1100 },
        { rank: 3, name: 'Emma Williams', score: 210, coins: 1050 },
        { rank: 4, name: 'David Brown', score: 195, coins: 980 },
        { rank: 5, name: 'You', score: 185, coins: 920 }
      ];

      setPracticeZoneStats({
        classLevel: 10,
        subjects,
        selectedSubject,
        chapters,
        selectedChapter: chapters[0] || '',
        chapterProgress,
        recentActivity,
        leaderboard
      });
    } catch (error) {
      console.error('Error loading practice data:', error);
      // Fallback to mock data
      setPracticeZoneStats({
        classLevel: 10,
        subjects: ['Mathematics', 'Science', 'Social Science', 'English'],
        selectedSubject: 'Mathematics',
        chapters: ['Real Numbers', 'Polynomials', 'Pair of Linear Equations'],
        selectedChapter: 'Real Numbers',
        chapterProgress: {
          completion_percentage: 65,
          correct: 13,
          coins_earned: 45,
          total_questions: 20
        },
        recentActivity: [
          {
            id: '1',
            subject: 'Mathematics',
            chapter: 'Real Numbers',
            correct: 8,
            total: 10,
            date: '2 hours ago',
            coins_earned: 15
          }
        ],
        leaderboard: [
          { rank: 1, name: 'Sarah Johnson', score: 245, coins: 1200 },
          { rank: 2, name: 'You', score: 185, coins: 920 }
        ]
      });
    } finally {
      setPracticeLoading(false);
    }
  };

  /* ensure profile */
  useEffect(() => {
    let aborted = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        navigate("/login");
        return;
      }
      if (profile?.id) return;

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (aborted || existing) return;

      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: (user.user_metadata?.full_name as string) || "Student",
        role: "student",
        coins: 100,
        updated_at: new Date().toISOString(),
      });
    })();
    return () => {
      aborted = true;
    };
  }, [navigate, profile?.id]);

  // memoized demo content (static)
  const recentTests = useMemo(
    () => [
      { id: 1, name: "Physics Midterm Practice", date: "May 14, 2025", questions: 15, subject: "Physics", status: "Completed", score: 87 },
      { id: 2, name: "Calculus Quiz", date: "May 10, 2025", questions: 10, subject: "Mathematics", status: "In Progress", progress: 60 },
      { id: 3, name: "Chemistry Practice Set", date: "May 02, 2025", questions: 12, subject: "Chemistry", status: "Completed", score: 92 },
      { id: 4, name: "Biology Revision Test", date: "Apr 28, 2025", questions: 20, subject: "Biology", status: "Completed", score: 78 },
    ],
    []
  );

  const announcements = useMemo(
    () => [
      { id: "a1", title: "Weekly Math Challenge", desc: "Join the math contest every Friday at 5 PM. Win up to 500 coins!", icon: School, date: "2d ago" },
      { id: "a2", title: "New Notes Feature", desc: "Create and organize your study notes with our new note-taking system.", icon: BookOpen, date: "1w ago" },
      { id: "a3", title: "Study Streak Bonus", desc: "Maintain a 7-day streak to earn 50 bonus coins!", icon: Flame, date: "3d ago" },
    ],
    []
  );

  const studyStats = useMemo(
    () => ({
      testsTaken: 12,
      avgScore: 85,
      studyHours: 56,
      streak: 7,
      rank: 23,
      accuracy: 78,
    }),
    []
  );

  // cursor-reactive background
  const mx = useMotionValue(320);
  const my = useMotionValue(160);
  const onMoveRaw = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!interactiveCards) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  }, [interactiveCards, mx, my]);
  const onMove = useRafThrottle(onMoveRaw);
  const bgGlow = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, rgba(47,58,68,.08), transparent 70%)
  `;

  // stable callbacks
  const goToHistory = useCallback(
    () => navigate("/dashboard/test-generator?tab=history"),
    [navigate]
  );

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Practice Zone Handlers
  const handleStartPractice = useCallback(() => {
    navigate("/practice/zone");
  }, [navigate]);

  const handleSubjectChange = async (subject: string) => {
    setPracticeZoneStats(prev => ({ ...prev, selectedSubject: subject }));
    try {
      const chapters = await pyqAPI.getChapters(10, subject);
      setPracticeZoneStats(prev => ({ 
        ...prev, 
        chapters, 
        selectedChapter: chapters[0] || '' 
      }));
    } catch (error) {
      console.error('Error loading chapters:', error);
    }
  };

  const handleChapterChange = async (chapter: string) => {
    setPracticeZoneStats(prev => ({ ...prev, selectedChapter: chapter }));
    if (profile) {
      try {
        const progress = await pyqAPI.getUserProgress(
          profile.id,
          10,
          practiceZoneStats.selectedSubject,
          chapter
        );
        setPracticeZoneStats(prev => ({ 
          ...prev, 
          chapterProgress: progress 
        }));
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    }
  };

  const coins = profile?.coins ?? 100;

  // Get first name for personalized greeting
  const getFirstName = () => {
    if (!profile?.full_name) return "Student";
    return profile.full_name.split(' ')[0];
  };

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh text-gray-900 dark:text-gray-100"
      style={{
        background:
          `radial-gradient(60rem 36rem at 50% 20%, rgba(255,255,255,0.95), rgba(255,255,255,0.65) 40%, transparent 72%),
           #DFE4EF`,
      }}
      onMouseMove={onMove}
    >
      {/* Scratch Card Popup */}
      <Suspense fallback={null}>
        <ScratchCard isOpen={showScratchCard} onClose={closeScratch} coins={100} />
      </Suspense>

      {interactiveCards && (
        <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: bgGlow }} />
      )}
      <div className="fixed inset-0 -z-20 opacity-[0.035] dark:opacity-[0.03] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={closeMobileSidebar}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden will-change-transform"
            >
              <DashboardSidebar onClose={closeMobileSidebar} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* header */}
        <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-30">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Left Section */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 h-9 w-9 flex-shrink-0 hover:bg-gray-100/80 active:scale-95 transition-all"
                  onClick={handleBack}
                  aria-label="Go back"
                >
                  <ArrowLeft size={18} className="text-gray-700" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden p-2 h-9 w-9 flex-shrink-0"
                  onClick={openMobileSidebar}
                >
                  <Menu size={18} />
                </Button>

                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <h1
                    className="text-[18px] sm:text-[24px] font-[700] tracking-[-0.012em] leading-tight truncate"
                    style={{ color: INK }}
                  >
                    {getFirstName()}'s Dashboard <span className="text-muted-foreground">— Student</span>
                  </h1>

                  <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0">
                    <Coins size={14} className="sm:size-4" />
                    <span className="hidden xs:inline">{coins} Coins</span>
                    <span className="xs:hidden">{coins}</span>
                  </div>

                  <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0">
                    <School size={14} className="sm:size-4" />
                    <span className="hidden xs:inline">Student</span>
                  </div>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <div className="hidden sm:block text-muted-foreground max-w-[120px] lg:max-w-[200px] truncate text-sm">
                  {profile?.full_name} {profile?.email ? `(${profile.email})` : ""}
                </div>
                <Button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate("/login");
                  }}
                  variant="destructive"
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto py-4 sm:py-6">
          <div className="mx-auto max-w-7xl px-3 sm:px-4">
            {/* Dashboard Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="w-full justify-start border-b p-0 bg-transparent gap-6">
                <TabsTrigger 
                  value="overview" 
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:font-semibold rounded-none"
                  style={{ 
                    color: activeTab === 'overview' ? A4AI_COLORS.primary : A4AI_COLORS.muted,
                    borderColor: A4AI_COLORS.primary 
                  }}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                {/* NEW DAILY PRACTICE TAB */}
                <TabsTrigger 
                  value="daily-practice" 
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:font-semibold rounded-none"
                  style={{ 
                    color: activeTab === 'daily-practice' ? A4AI_COLORS.primary : A4AI_COLORS.muted,
                    borderColor: A4AI_COLORS.primary 
                  }}
                >
                  <TargetPracticeIcon className="h-4 w-4 mr-2" />
                  Daily Practice
                </TabsTrigger>
                {/* END NEW TAB */}
                <TabsTrigger 
                  value="practice" 
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:font-semibold rounded-none"
                  style={{ 
                    color: activeTab === 'practice' ? A4AI_COLORS.primary : A4AI_COLORS.muted,
                    borderColor: A4AI_COLORS.primary 
                  }}
                >
                  <BookMarked className="h-4 w-4 mr-2" />
                  Practice Zone
                </TabsTrigger>
                <TabsTrigger 
                  value="tests" 
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:font-semibold rounded-none"
                  style={{ 
                    color: activeTab === 'tests' ? A4AI_COLORS.primary : A4AI_COLORS.muted,
                    borderColor: A4AI_COLORS.primary 
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  My Tests
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:font-semibold rounded-none"
                  style={{ 
                    color: activeTab === 'analytics' ? A4AI_COLORS.primary : A4AI_COLORS.muted,
                    borderColor: A4AI_COLORS.primary 
                  }}
                >
                  <LineChart className="h-4 w-4 mr-2" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-4 sm:space-y-6"
                >
                  {/* welcome card */}
                  <motion.div variants={item}>
                    <Card className="border card-soft bg-gradient-to-r from-blue-50 to-indigo-50">
                      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle
                            className="text-[16px] sm:text-[18px] font-[650] tracking-[-0.01em] truncate"
                            style={{ color: INK }}
                          >
                            Welcome back, {getFirstName()}! 👋
                          </CardTitle>
                          <CardDescription
                            className="tracking-[-0.005em] text-xs sm:text-sm"
                            style={{ color: SLATE }}
                          >
                            Ready to continue your learning journey? Practice with AI-powered tests.
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                          <Link to="/dashboard/test-generator" className="flex-1 sm:flex-none min-w-0">
                            <Button className="gap-2 w-full sm:w-auto rounded-xl bg-gray-900 text-white hover:bg-black active:scale-[.98] shadow-lg text-xs sm:text-sm">
                              <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="truncate">Take Practice Test</span>
                            </Button>
                          </Link>

                          <Button variant="outline" onClick={goToHistory} className="flex-1 sm:flex-none text-xs sm:text-sm">
                            <span className="truncate">View History</span>
                          </Button>

                          <Link to="/dashboard/contests" className="flex-1 sm:flex-none min-w-0">
                            <Button variant="ghost" className="gap-1 w-full sm:w-auto text-xs sm:text-sm">
                              <Award className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="truncate">Join Contests</span>
                            </Button>
                          </Link>
                        </div>
                      </CardHeader>
                    </Card>
                  </motion.div>

                  {/* Study KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
                    <KpiCard title="Tests Taken" value={studyStats.testsTaken} icon={FileText} tone="blue" interactive={interactiveCards} />
                    <KpiCard title="Avg Score" value={`${studyStats.avgScore}%`} icon={TrendingUp} tone="green" interactive={interactiveCards} />
                    <KpiCard title="Study Hours" value={studyStats.studyHours} icon={Clock} tone="purple" interactive={interactiveCards} />
                    <KpiCard title="Day Streak" value={studyStats.streak} icon={Flame} tone="amber" interactive={interactiveCards} />
                    <KpiCard title="Rank" value={`#${studyStats.rank}`} icon={Target} tone="indigo" interactive={interactiveCards} />
                    <KpiCard title="Accuracy" value={`${studyStats.accuracy}%`} icon={BarChart3} tone="teal" interactive={interactiveCards} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* recent tests */}
                    <motion.div variants={item} className="lg:col-span-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[14px] sm:text-[16px] font-[600] tracking-[-0.01em]" style={{ color: INK }}>
                          Recent Practice Tests
                        </h2>
                        <Button variant="ghost" size="sm" className="text-gray-900 dark:text-gray-50 text-xs sm:text-sm" onClick={goToHistory}>
                          View All
                        </Button>
                      </div>
                      <AnimatePresence initial={false}>
                        {recentTests.map((t) => (
                          <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="group"
                          >
                            <Card className="border hover:shadow-md transition-shadow">
                              <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span
                                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                        t.subject === "Physics"
                                          ? "bg-red-400"
                                          : t.subject === "Mathematics"
                                          ? "bg-blue-400"
                                          : t.subject === "Chemistry"
                                          ? "bg-green-400"
                                          : "bg-purple-400"
                                      }`}
                                    />
                                    <h3
                                      className="font-[600] tracking-[-0.01em] truncate text-sm sm:text-base"
                                      style={{ color: INK }}
                                    >
                                      {t.name}
                                    </h3>
                                    <Badge variant="secondary" className="ml-1 shrink-0 text-xs">
                                      {t.subject}
                                    </Badge>
                                    {t.status === "Completed" ? (
                                      <Badge className="ml-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 text-xs">
                                        <Target className="h-3 w-3 mr-1" />
                                        {t.score}%
                                      </Badge>
                                    ) : (
                                      <Badge className="ml-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0 text-xs">
                                        <TimerReset className="h-3 w-3 mr-1" />
                                        {t.progress}%
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                    {t.date} • {t.questions} questions
                                  </p>
                                </div>
                                <div className="flex gap-2 justify-end sm:justify-start">
                                  <Button variant="outline" size="sm" className="text-xs sm:text-sm flex-1 sm:flex-none">
                                    {t.status === "Completed" ? "Review" : "Continue"}
                                  </Button>
                                  <Button variant="outline" size="sm" className="text-xs sm:text-sm hidden sm:inline-flex">
                                    Retake
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>

                    {/* Right Column */}
                    <div className="space-y-4 sm:space-y-6">
                      {/* Announcements */}
                      <motion.div variants={item}>
                        <Card className="h-full">
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <BellDot className="h-4 w-4" />
                              <CardTitle
                                className="text-sm sm:text-base font-[600] tracking-[-0.01em]"
                                style={{ color: INK }}
                              >
                                Updates & Announcements
                              </CardTitle>
                            </div>
                            <CardDescription className="text-xs sm:text-sm">Stay updated with what's new</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 sm:space-y-4">
                            {announcements.map((a) => (
                              <div key={a.id} className="rounded-lg border bg-muted/40 p-2 sm:p-3 hover:bg-muted/60 transition-colors">
                                <div className="flex items-center gap-2 font-medium text-sm sm:text-base">
                                  <a.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="truncate">{a.title}</span>
                                </div>
                                <div className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{a.desc}</div>
                                <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground">{a.date}</div>
                              </div>
                            ))}
                            <Link to="/announcements">
                              <Button variant="ghost" className="w-full text-xs sm:text-sm">
                                View all announcements
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      </motion.div>

                      {/* Quick Links */}
                      <motion.div variants={item}>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle
                              className="text-sm sm:text-base font-[600] tracking-[-0.01em]"
                              style={{ color: INK }}
                            >
                              Quick Actions
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">Access your tools faster</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <Link to="/practice/zone">
                              <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                                <BookMarked className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>PYQ Practice</span>
                              </Button>
                            </Link>
                            
                            <Link to="/daily-practice">
                              <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                                <TargetPracticeIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>Daily Practice</span>
                              </Button>
                            </Link>
                            
                            <Link to="/dashboard/notes">
                              <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>My Study Notes</span>
                              </Button>
                            </Link>
                            <Link to="/dashboard/contests">
                              <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                                <School className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>Join Contests</span>
                              </Button>
                            </Link>
                            <Link to="/dashboard/analytics">
                              <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>Performance Analytics</span>
                              </Button>
                            </Link>
                            <Link to="/dashboard/leaderboard">
                              <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>View Leaderboard</span>
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </div>
                  </div>

                  {/* CTA */}
                  <motion.div
                    variants={item}
                    className="rounded-xl sm:rounded-2xl border p-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.06)]"
                  >
                    <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-white">
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[16px] sm:text-[18px] font-[600] tracking-[-0.01em] truncate"
                        >
                          🎯 Ready for a Challenge?
                        </div>
                        <div className="text-sm opacity-90">
                          Join today's live contest and compete with students worldwide!
                        </div>
                      </div>
                      <Link to="/dashboard/contest/create" className="w-full sm:w-auto">
                        <Button className="gap-2 w-full sm:w-auto rounded-xl bg-white text-blue-600 hover:bg-gray-100 active:scale-[.98] shadow-lg text-xs sm:text-sm">
                          <Rocket className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>Join Contest Now</span>
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                </motion.div>
              </TabsContent>

              {/* Daily Practice Tab */}
              <TabsContent value="daily-practice" className="space-y-6">
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-6"
                >
                  {/* Daily Practice Header */}
                  <motion.div variants={item}>
                    <Card className="border shadow-sm overflow-hidden">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 opacity-10"></div>
                        <CardHeader className="relative">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <CardTitle className="text-xl sm:text-2xl flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.success}10` }}>
                                  <TargetPracticeIcon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: A4AI_COLORS.success }} />
                                </div>
                                Daily Practice Challenge
                              </CardTitle>
                              <CardDescription className="text-base mt-2">
                                Solve 5 questions daily. Earn <span className="font-bold text-yellow-600">+5 coins</span> for each correct answer.
                                Maintain your streak for bonus rewards!
                              </CardDescription>
                            </div>
                            <Button 
                              onClick={() => navigate('/daily-practice')}
                              size="lg"
                              style={{ 
                                backgroundColor: A4AI_COLORS.success,
                                color: 'white'
                              }}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start Daily Practice
                            </Button>
                          </div>
                        </CardHeader>
                      </div>
                    </Card>
                  </motion.div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div variants={item}>
                      <Card className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Today's Progress</p>
                              <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                0/5
                              </p>
                              <div className="flex items-center gap-1 mt-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }}></div>
                                </div>
                                <span className="text-xs font-medium text-gray-600">0%</span>
                              </div>
                            </div>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.success}10` }}>
                              <TargetPracticeIcon className="h-5 w-5" style={{ color: A4AI_COLORS.success }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div variants={item}>
                      <Card className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Current Streak</p>
                              <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                {studyStats.streak} days
                              </p>
                              <p className="text-xs mt-1" style={{ color: A4AI_COLORS.muted }}>
                                Keep it going!
                              </p>
                            </div>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.danger}10` }}>
                              <Flame className="h-5 w-5" style={{ color: A4AI_COLORS.danger }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div variants={item}>
                      <Card className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Total Coins Earned</p>
                              <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                {practiceZoneStats.chapterProgress.coins_earned}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                <span className="text-xs font-medium text-green-600">+25 today</span>
                              </div>
                            </div>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.warning}10` }}>
                              <Coins className="h-5 w-5" style={{ color: A4AI_COLORS.warning }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div variants={item}>
                      <Card className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Practice Accuracy</p>
                              <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                {studyStats.accuracy}%
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <TrendingUp className="h-3 w-3 text-blue-500" />
                                <span className="text-xs font-medium text-blue-600">+5% this week</span>
                              </div>
                            </div>
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.info}10` }}>
                              <TrendingUpIcon className="h-5 w-5" style={{ color: A4AI_COLORS.info }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Practice Options */}
                    <motion.div variants={item} className="lg:col-span-2 space-y-6">
                      {/* Class Selection */}
                      <Card className="border shadow-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <School className="h-5 w-5" />
                            Select Your Class & Subject
                          </CardTitle>
                          <CardDescription>
                            Choose your class and subject to start daily practice
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div>
                            <h3 className="font-semibold mb-3 text-sm">Class Level</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <Button
                                variant="default"
                                className="h-auto py-3 bg-blue-600 hover:bg-blue-700"
                                onClick={() => navigate('/daily-practice')}
                              >
                                <div className="text-center">
                                  <div className="text-lg">🔬</div>
                                  <div className="font-semibold">Class 10</div>
                                  <div className="text-xs opacity-90 mt-1">Science & Maths</div>
                                </div>
                              </Button>
                              <Button
                                variant="outline"
                                className="h-auto py-3 border-gray-300 hover:bg-gray-50"
                                onClick={() => navigate('/daily-practice')}
                              >
                                <div className="text-center">
                                  <div className="text-lg">📚</div>
                                  <div className="font-semibold">Class 12</div>
                                  <div className="text-xs opacity-90 mt-1">Advanced Concepts</div>
                                </div>
                              </Button>
                            </div>
                          </div>

                          <div>
                            <h3 className="font-semibold mb-3 text-sm">Subjects</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <Button
                                variant="default"
                                className="h-auto py-3 bg-green-600 hover:bg-green-700"
                                onClick={() => navigate('/daily-practice')}
                              >
                                <div className="text-center">
                                  <div className="text-lg">🧪</div>
                                  <div className="font-semibold">Science</div>
                                  <div className="text-xs opacity-90 mt-1">Physics, Chemistry, Biology</div>
                                </div>
                              </Button>
                              <Button
                                variant="outline"
                                className="h-auto py-3 border-gray-300 hover:bg-gray-50"
                                onClick={() => navigate('/daily-practice')}
                              >
                                <div className="text-center">
                                  <div className="text-lg">📐</div>
                                  <div className="font-semibold">Mathematics</div>
                                  <div className="text-xs opacity-90 mt-1">All Chapters</div>
                                </div>
                              </Button>
                            </div>
                          </div>

                          <div>
                            <h3 className="font-semibold mb-3 text-sm">Chapters Available (Science)</h3>
                            <div className="grid grid-cols-5 gap-2">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(chapter => (
                                <Button
                                  key={chapter}
                                  variant={chapter === 1 ? "default" : "outline"}
                                  className={`h-auto py-2 ${chapter === 1 ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                                  onClick={() => navigate('/daily-practice')}
                                >
                                  <div className="text-center">
                                    <div className="text-xs">📖</div>
                                    <div className="text-xs font-medium mt-1">Ch {chapter}</div>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Daily Practice CTA */}
                      <Card className="border shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-green-600" />
                                Ready for Today's Challenge?
                              </h3>
                              <p className="text-gray-600 mb-4">
                                Complete your 5 daily questions to earn coins and maintain your streak.
                                New questions available every day!
                              </p>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                  <span>5 Questions • 10 minutes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Coins className="h-4 w-4 text-yellow-500" />
                                  <span>+5 coins per correct answer</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={() => navigate('/daily-practice')}
                              size="lg"
                              className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start Now
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>

                    {/* Right Column - Stats & Info */}
                    <div className="space-y-6">
                      {/* How It Works */}
                      <motion.div variants={item}>
                        <Card className="border shadow-sm">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <HelpCircle className="h-5 w-5" />
                              How Daily Practice Works
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-blue-600">1</span>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm">Choose Class & Subject</h4>
                                <p className="text-xs text-gray-600 mt-1">Select Class 10/12 and Science/Maths</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-green-600">2</span>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm">Pick Chapter</h4>
                                <p className="text-xs text-gray-600 mt-1">Select from Chapters 1-10</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-purple-600">3</span>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm">Solve Questions</h4>
                                <p className="text-xs text-gray-600 mt-1">Answer 5 questions with timer</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-yellow-600">4</span>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm">Earn Rewards</h4>
                                <p className="text-xs text-gray-600 mt-1">Get +5 coins for each correct answer</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      {/* Streak Info */}
                      <motion.div variants={item}>
                        <Card className="border shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <Flame className="h-5 w-5 text-orange-500" />
                              Your Streak Progress
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Flame className="h-4 w-4 text-orange-500" />
                                  <span className="text-sm">Current Streak</span>
                                </div>
                                <span className="font-bold">{studyStats.streak} days</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Award className="h-4 w-4 text-yellow-500" />
                                  <span className="text-sm">Longest Streak</span>
                                </div>
                                <span className="font-bold">14 days</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Coins className="h-4 w-4 text-green-500" />
                                  <span className="text-sm">Coins from Streak</span>
                                </div>
                                <span className="font-bold">350 coins</span>
                              </div>
                              <div className="pt-3 border-t">
                                <p className="text-xs text-gray-600">
                                  🔥 Maintain a 7-day streak to unlock bonus coins and special rewards!
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      {/* Quick Stats */}
                      <motion.div variants={item}>
                        <Card className="border shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Daily Practice Stats</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <TargetPracticeIcon className="h-4 w-4 text-blue-500" />
                                <span className="text-sm">Questions Today</span>
                              </div>
                              <span className="font-bold">0/5</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Coins className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm">Coins Today</span>
                              </div>
                              <span className="font-bold">0</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-purple-500" />
                                <span className="text-sm">This Week</span>
                              </div>
                              <span className="font-bold">0/5 days</span>
                            </div>
                            <div className="pt-3 border-t">
                              <Button 
                                onClick={() => navigate('/daily-practice')}
                                variant="outline" 
                                className="w-full text-sm"
                              >
                                <Play className="h-3 w-3 mr-2" />
                                Start Today's Practice
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Practice Zone Tab */}
              <TabsContent value="practice" className="space-y-6">
                {practiceLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-6"
                  >
                    {/* Practice Zone Header */}
                    <motion.div variants={item}>
                      <Card className="border shadow-sm overflow-hidden">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-10"></div>
                          <CardHeader className="relative">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl sm:text-2xl flex items-center gap-3">
                                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.primary}10` }}>
                                    <BookMarked className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: A4AI_COLORS.primary }} />
                                  </div>
                                  PYQ Practice Zone
                                </CardTitle>
                                <CardDescription className="text-base mt-2">
                                  Practice Previous Year Questions (PYQs) and master concepts for Class 10 & 12
                                </CardDescription>
                              </div>
                              <Button 
                                onClick={handleStartPractice}
                                size="lg"
                                style={{ 
                                  backgroundColor: A4AI_COLORS.primary,
                                  color: 'white'
                                }}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Start Practice Session
                              </Button>
                            </div>
                          </CardHeader>
                        </div>
                      </Card>
                    </motion.div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <motion.div variants={item}>
                        <Card className="border shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Chapter Progress</p>
                                <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                  {practiceZoneStats.chapterProgress.completion_percentage.toFixed(0)}%
                                </p>
                                <Progress 
                                  value={practiceZoneStats.chapterProgress.completion_percentage} 
                                  className="h-2 mt-2" 
                                />
                              </div>
                              <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.success}10` }}>
                                <TrendingUp className="h-5 w-5" style={{ color: A4AI_COLORS.success }} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      <motion.div variants={item}>
                        <Card className="border shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Correct Answers</p>
                                <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                  {practiceZoneStats.chapterProgress.correct}
                                </p>
                                <p className="text-xs mt-1" style={{ color: A4AI_COLORS.muted }}>
                                  of {practiceZoneStats.chapterProgress.total_questions}
                                </p>
                              </div>
                              <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.info}10` }}>
                                <CheckCircle className="h-5 w-5" style={{ color: A4AI_COLORS.info }} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      <motion.div variants={item}>
                        <Card className="border shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Coins Earned</p>
                                <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                  {practiceZoneStats.chapterProgress.coins_earned}
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                  <TrendingUp className="h-3 w-3 text-green-500" />
                                  <span className="text-xs font-medium text-green-600">+15%</span>
                                </div>
                              </div>
                              <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.warning}10` }}>
                                <Coins className="h-5 w-5" style={{ color: A4AI_COLORS.warning }} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      <motion.div variants={item}>
                        <Card className="border shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Practice Streak</p>
                                <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>
                                  {studyStats.streak} days
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                  <Flame className="h-3 w-3 text-red-500" />
                                  <span className="text-xs font-medium text-red-600">Keep it up!</span>
                                </div>
                              </div>
                              <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.danger}10` }}>
                                <Flame className="h-5 w-5" style={{ color: A4AI_COLORS.danger }} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Subject Selection */}
                      <motion.div variants={item} className="lg:col-span-2 space-y-6">
                        <Card className="border shadow-sm">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BookOpen className="h-5 w-5" />
                              Select Subject & Chapter
                            </CardTitle>
                            <CardDescription>
                              Choose what you want to practice
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Subject Selection */}
                            <div>
                              <h3 className="font-semibold mb-3">Subject</h3>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {practiceZoneStats.subjects.map(subject => (
                                  <Button
                                    key={subject}
                                    variant={practiceZoneStats.selectedSubject === subject ? "default" : "outline"}
                                    className={`h-auto py-3 ${practiceZoneStats.selectedSubject === subject ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                                    onClick={() => handleSubjectChange(subject)}
                                  >
                                    <span className="text-sm font-medium">{subject}</span>
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {/* Chapter Selection */}
                            {practiceZoneStats.selectedSubject && (
                              <div>
                                <h3 className="font-semibold mb-3">Chapter</h3>
                                <div className="space-y-2">
                                  {practiceZoneStats.chapters.map(chapter => (
                                    <Button
                                      key={chapter}
                                      variant={practiceZoneStats.selectedChapter === chapter ? "default" : "outline"}
                                      className={`w-full justify-start h-auto py-3 ${practiceZoneStats.selectedChapter === chapter ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                      onClick={() => handleChapterChange(chapter)}
                                    >
                                      <span className="text-left">{chapter}</span>
                                      {practiceZoneStats.selectedChapter === chapter && (
                                        <ChevronRight className="ml-auto h-4 w-4" />
                                      )}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Chapter Progress */}
                            {practiceZoneStats.selectedChapter && (
                              <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-semibold mb-2">{practiceZoneStats.selectedChapter} Progress</h3>
                                <div className="space-y-3">
                                  <div>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span style={{ color: A4AI_COLORS.muted }}>Completion</span>
                                      <span className="font-semibold">{practiceZoneStats.chapterProgress.completion_percentage.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={practiceZoneStats.chapterProgress.completion_percentage} className="h-2" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-2 bg-white rounded-lg">
                                      <div className="text-lg font-bold text-blue-600">
                                        {practiceZoneStats.chapterProgress.correct}
                                      </div>
                                      <div className="text-xs text-gray-600">Correct</div>
                                    </div>
                                    <div className="text-center p-2 bg-white rounded-lg">
                                      <div className="text-lg font-bold text-green-600">
                                        {practiceZoneStats.chapterProgress.coins_earned}
                                      </div>
                                      <div className="text-xs text-gray-600">Coins Earned</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Recent Activity */}
                        <Card className="border shadow-sm">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <History className="h-5 w-5" />
                              Recent Practice Activity
                            </CardTitle>
                            <CardDescription>
                              Your recent practice sessions and performance
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {practiceZoneStats.recentActivity.map(activity => (
                                <div 
                                  key={activity.id} 
                                  className="flex items-center justify-between p-3 rounded-lg border hover:border-gray-300 transition-colors"
                                  style={{ 
                                    backgroundColor: A4AI_COLORS.card,
                                    borderColor: A4AI_COLORS.border
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.primary}10` }}>
                                      <BookOpen className="h-5 w-5" style={{ color: A4AI_COLORS.primary }} />
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-1" style={{ color: A4AI_COLORS.text }}>
                                        {activity.subject} - {activity.chapter}
                                      </h4>
                                      <div className="flex items-center gap-3 text-sm" style={{ color: A4AI_COLORS.muted }}>
                                        <span>{activity.correct}/{activity.total} correct</span>
                                        <span>•</span>
                                        <span>+{activity.coins_earned} coins</span>
                                        <span>•</span>
                                        <span>{activity.date}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Badge 
                                    className="font-medium"
                                    style={{ 
                                      backgroundColor: (activity.correct/activity.total) > 0.7 ? `${A4AI_COLORS.success}10` : 
                                                     (activity.correct/activity.total) > 0.5 ? `${A4AI_COLORS.warning}10` : 
                                                     `${A4AI_COLORS.danger}10`,
                                      color: (activity.correct/activity.total) > 0.7 ? A4AI_COLORS.success : 
                                             (activity.correct/activity.total) > 0.5 ? A4AI_COLORS.warning : 
                                             A4AI_COLORS.danger
                                    }}
                                  >
                                    {Math.round((activity.correct/activity.total) * 100)}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      {/* Right Column - Quick Actions & Leaderboard */}
                      <div className="space-y-6">
                        {/* Practice Modes */}
                        <motion.div variants={item}>
                          <Card className="border shadow-sm">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <ZapIcon className="h-5 w-5" />
                                Practice Modes
                              </CardTitle>
                              <CardDescription>
                                Different ways to practice
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <Button
                                onClick={handleStartPractice}
                                className="w-full justify-start gap-3 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                              >
                                <Sparkles className="h-5 w-5" />
                                <div className="text-left">
                                  <div className="font-semibold">Mixed Practice</div>
                                  <div className="text-sm opacity-90">All question types</div>
                                </div>
                              </Button>

                              <div className="grid grid-cols-2 gap-3">
                                <Button
                                  variant="outline"
                                  className="h-auto py-3 border-blue-200 hover:bg-blue-50"
                                  onClick={() => navigate('/practice/zone?type=PYQ')}
                                >
                                  <div className="text-left">
                                    <div className="font-semibold">PYQs</div>
                                    <div className="text-xs text-gray-600">Previous Year</div>
                                  </div>
                                </Button>

                                <Button
                                  variant="outline"
                                  className="h-auto py-3 border-red-200 hover:bg-red-50"
                                  onClick={() => navigate('/practice/zone?type=HOTS')}
                                >
                                  <div className="text-left">
                                    <div className="font-semibold">HOTS</div>
                                    <div className="text-xs text-gray-600">Higher Order</div>
                                  </div>
                                </Button>

                                <Button
                                  variant="outline"
                                  className="h-auto py-3 border-green-200 hover:bg-green-50"
                                  onClick={() => navigate('/practice/zone?type=MOST_REPEATED')}
                                >
                                  <div className="text-left">
                                    <div className="font-semibold">Repeated</div>
                                    <div className="text-xs text-gray-600">Most Common</div>
                                  </div>
                                </Button>

                                <Button
                                  variant="outline"
                                  className="h-auto py-3 border-purple-200 hover:bg-purple-50"
                                  onClick={() => navigate('/practice/zone?type=MOST_POPULAR')}
                                >
                                  <div className="text-left">
                                    <div className="font-semibold">Popular</div>
                                    <div className="text-xs text-gray-600">Trending</div>
                                  </div>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>

                        {/* Leaderboard */}
                        <motion.div variants={item}>
                          <Card className="border shadow-sm">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5" />
                                Practice Leaderboard
                              </CardTitle>
                              <CardDescription>
                                Top performers this week
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {practiceZoneStats.leaderboard.map(player => (
                                  <div 
                                    key={player.rank} 
                                    className={`flex items-center justify-between p-2 rounded-lg ${
                                      player.name === 'You' ? 'bg-blue-50 border border-blue-200' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                        player.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                                        player.rank === 2 ? 'bg-gray-100 text-gray-800' :
                                        player.rank === 3 ? 'bg-orange-100 text-orange-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                        {player.rank}
                                      </div>
                                      <div>
                                        <h4 className={`font-medium ${
                                          player.name === 'You' ? 'text-blue-700 font-bold' : 'text-gray-800'
                                        }`}>
                                          {player.name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                          <span>{player.score} pts</span>
                                          <span>•</span>
                                          <Coins className="h-3 w-3" />
                                          <span>{player.coins}</span>
                                        </div>
                                      </div>
                                    </div>
                                    {player.rank <= 3 && (
                                      <div className={`p-1 rounded ${
                                        player.rank === 1 ? 'bg-yellow-100' :
                                        player.rank === 2 ? 'bg-gray-100' :
                                        'bg-orange-100'
                                      }`}>
                                        <Trophy className={`h-4 w-4 ${
                                          player.rank === 1 ? 'text-yellow-600' :
                                          player.rank === 2 ? 'text-gray-600' :
                                          'text-orange-600'
                                        }`} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>

                        {/* Quick Stats */}
                        <motion.div variants={item}>
                          <Card className="border shadow-sm">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">Your Stats</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Coins className="h-4 w-4 text-yellow-500" />
                                  <span className="text-sm">Total Coins</span>
                                </div>
                                <span className="font-bold">{coins}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <TargetIcon2 className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm">Accuracy</span>
                                </div>
                                <span className="font-bold">{studyStats.accuracy}%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Flame className="h-4 w-4 text-red-500" />
                                  <span className="text-sm">Streak</span>
                                </div>
                                <span className="font-bold">{studyStats.streak} days</span>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </div>
                    </div>

                    {/* Bottom CTA */}
                    <motion.div variants={item}>
                      <Card className="border shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-bold mb-2">Ready to boost your preparation?</h3>
                              <p className="text-gray-600">
                                Start a focused practice session with personalized questions and detailed explanations.
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <Button
                                onClick={handleStartPractice}
                                size="lg"
                                style={{ 
                                  backgroundColor: A4AI_COLORS.primary,
                                  color: 'white'
                                }}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Start Practice Now
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => navigate('/practice/zone?mode=timed')}
                              >
                                <TimerReset className="h-4 w-4 mr-2" />
                                Timed Test
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  </motion.div>
                )}
              </TabsContent>

              {/* Tests Tab */}
              <TabsContent value="tests" className="space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>My Tests & Assignments</CardTitle>
                    <CardDescription>View and manage your tests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentTests.map((test) => (
                        <div 
                          key={test.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:border-gray-300 transition-colors"
                          style={{ 
                            backgroundColor: A4AI_COLORS.card,
                            borderColor: A4AI_COLORS.border
                          }}
                        >
                          <div className="flex items-start gap-4 mb-3 sm:mb-0">
                            <div 
                              className="p-3 rounded-lg"
                              style={{ backgroundColor: `${test.subject === "Physics" ? "#ef4444" : test.subject === "Mathematics" ? "#3b82f6" : test.subject === "Chemistry" ? "#10b981" : "#8b5cf6"}10` }}
                            >
                              <FileText className="h-6 w-6" style={{ color: test.subject === "Physics" ? "#ef4444" : test.subject === "Mathematics" ? "#3b82f6" : test.subject === "Chemistry" ? "#10b981" : "#8b5cf6" }} />
                            </div>
                            <div>
                              <h4 className="font-semibold mb-1" style={{ color: A4AI_COLORS.text }}>
                                {test.name}
                              </h4>
                              <div className="flex items-center gap-3 text-sm" style={{ color: A4AI_COLORS.muted }}>
                                <span>{test.date}</span>
                                <span>•</span>
                                <span>{test.questions} questions</span>
                                <span>•</span>
                                <span>{test.subject}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {test.status === "Completed" ? (
                              <>
                                <Badge 
                                  className="font-medium"
                                  style={{ 
                                    backgroundColor: `${A4AI_COLORS.success}10`,
                                    color: A4AI_COLORS.success
                                  }}
                                >
                                  Score: {test.score}%
                                </Badge>
                                <Button variant="outline" size="sm">
                                  Review
                                </Button>
                              </>
                            ) : (
                              <>
                                <Badge 
                                  className="font-medium"
                                  style={{ 
                                    backgroundColor: `${A4AI_COLORS.warning}10`,
                                    color: A4AI_COLORS.warning
                                  }}
                                >
                                  {test.progress}% Complete
                                </Badge>
                                <Button variant="outline" size="sm">
                                  Continue
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>Performance Analytics</CardTitle>
                    <CardDescription>Detailed insights into your learning progress</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-semibold">Subject-wise Performance</h3>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">Mathematics</span>
                              <span className="text-sm font-medium">85%</span>
                            </div>
                            <Progress value={85} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">Science</span>
                              <span className="text-sm font-medium">78%</span>
                            </div>
                            <Progress value={78} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">English</span>
                              <span className="text-sm font-medium">92%</span>
                            </div>
                            <Progress value={92} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">Social Science</span>
                              <span className="text-sm font-medium">81%</span>
                            </div>
                            <Progress value={81} className="h-2" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="font-semibold">Study Habits</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Average Daily Study Time</p>
                              <p className="text-xs text-gray-600">Last 30 days</p>
                            </div>
                            <Badge>2.5 hours</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Test Completion Rate</p>
                              <p className="text-xs text-gray-600">Started vs Completed</p>
                            </div>
                            <Badge>94%</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Practice Questions Attempted</p>
                              <p className="text-xs text-gray-600">This month</p>
                            </div>
                            <Badge>156</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Improvement Rate</p>
                              <p className="text-xs text-gray-600">Score increase over time</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">+12%</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ------- KPI Card ------- */
type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const KpiCard = memo(function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "blue",
  interactive,
}: {
  title: string;
  value: string | number;
  icon: IconType;
  tone?: "blue" | "green" | "purple" | "amber" | "indigo" | "teal";
  interactive: boolean;
}) {
  const mx = useMotionValue(60);
  const my = useMotionValue(40);
  const rotateX = useTransform(my, [0, 120], [6, -6]);
  const rotateY = useTransform(mx, [0, 180], [-8, 8]);

  const onMoveRaw = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  }, [interactive, mx, my]);

  const onMove = useRafThrottle(onMoveRaw);

  const resetPos = useCallback(() => {
    mx.set(60);
    my.set(40);
  }, [mx, my]);

  const TONES = {
    blue: { border: "from-blue-400/45 to-blue-500/45", chip: "bg-blue-500/10 text-blue-700" },
    green: { border: "from-emerald-400/45 to-green-500/45", chip: "bg-emerald-500/10 text-emerald-700" },
    purple: { border: "from-purple-400/45 to-purple-500/45", chip: "bg-purple-500/10 text-purple-700" },
    amber: { border: "from-amber-400/45 to-orange-400/45", chip: "bg-amber-500/10 text-amber-700" },
    indigo: { border: "from-indigo-400/45 to-indigo-500/45", chip: "bg-indigo-500/10 text-indigo-700" },
    teal: { border: "from-teal-400/45 to-cyan-400/45", chip: "bg-teal-500/10 text-teal-700" },
  } as const;
  const t = TONES[tone] || TONES.blue;

  return (
    <div onMouseMove={onMove} onMouseLeave={resetPos} style={{ perspective: 1000 }}>
      <motion.div
        style={interactive ? { rotateX, rotateY } : undefined}
        whileHover={!interactive ? ({ scale: 1.01 } as any) : undefined}
        className="relative rounded-xl sm:rounded-2xl border bg-card card-soft transition-all shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.05)] p-[1px]"
      >
        <div className={`rounded-xl sm:rounded-2xl bg-gradient-to-tr ${t.border} p-0.5`}>
          <div className="rounded-xl sm:rounded-2xl bg-card/95 backdrop-blur px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-muted-foreground tracking-[-0.005em] truncate">
                {title}
              </div>
              <div className={`p-1 sm:p-2 rounded-lg ${t.chip}`}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            <div
              className="mt-1 sm:mt-2 text-[20px] sm:text-[30px] leading-none font-[700] tracking-[-0.015em] num"
              style={{ color: INK }}
            >
              {value}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});