// src/pages/TeacherDashboardPage.tsx
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
    Users,
    BookOpen,
    School,
    BarChart3,
    Clock,
    Trophy,
    Award,
    GraduationCap,
    Eye,
    CheckCircle,
    AlertCircle,
    Target,
    Brain,
    Calendar,
    Edit,
    Filter,
    UserPlus,
    Shield,
    Layers,
  } from "lucide-react";
  
  /* ------------ tiny media hook (stable) ------------ */
  function useMedia(q: string) {
    const [m, setM] = useState(false);
    useEffect(() => {
      // guard SSR
      if (typeof window === "undefined" || !("matchMedia" in window)) return;
      const mq = window.matchMedia(q);
      const h = () => setM(mq.matches);
      h();
      try {
        mq.addEventListener("change", h);
        return () => mq.removeEventListener("change", h);
      } catch {
        // Safari
        // @ts-ignore
        mq.addListener(h);
        // @ts-ignore
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
          // @ts-ignore
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
  
  export default function TeacherDashboardPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { profile, loading } = useUserProfile();
  
    const prefersReducedMotion = useReducedMotion();
    const isMobile = useIsMobile();
    const isCoarse = useCoarse();
    const interactiveCards = !(isMobile || isCoarse || prefersReducedMotion);
  
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
    const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  
    // Scratch Card State
    const [showScratchCard, setShowScratchCard] = useState(false);
    const closeScratch = useCallback(() => {
      setShowScratchCard(false);
      safeStorage.set("hasSeenCoinPopup", "true");
    }, []);
    // keep timeout ids for cleanup
    const popupTimers = useRef<number[]>([]);
  
    /** Check if new user and show coins popup (robust & abortable) */
    useEffect(() => {
      if (loading || !profile) return;
  
      const isNewUser = searchParams.get("newUser") === "true";
      const storedHasSeenPopup = safeStorage.get("hasSeenCoinPopup");
      const shouldShowForCoins = !!profile?.coins && profile.coins >= 200 && !storedHasSeenPopup;
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
        // clear any pending timers to avoid state updates after unmount/route changes
        popupTimers.current.forEach((id) => clearTimeout(id));
        popupTimers.current = [];
      };
      // We only want to re-run when actual values change, not object identity
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, profile?.id, profile?.coins, searchParams.get("newUser")]);
  
    /* ensure profile */
    // Avoid duplicating profile fetch logic already handled by useUserProfile; keep only auth gate + best-effort ensure row
    useEffect(() => {
      let aborted = false;
      (async () => {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) {
          navigate("/login");
          return;
        }
        // If hook already gave a profile row, skip insert.
        if (profile?.id) return;
  
        // Best-effort check to ensure profile row; no UI change if this fails (RLS etc.)
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();
  
        if (aborted || existing) return;
  
        // Try insert only if missing; swallow errors to avoid blocking UX under traffic
        await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name: (user.user_metadata?.full_name as string) || "Teacher",
          role: "teacher",
          coins: 200,
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
        { id: 1, name: "Physics Midterm", date: "May 14, 2025", students: 45, subject: "Physics", status: "Published", avgScore: 78 },
        { id: 2, name: "Calculus Quiz - Advanced", date: "May 10, 2025", students: 32, subject: "Mathematics", status: "Draft", avgScore: "-" },
        { id: 3, name: "Chemistry Practice Set", date: "May 02, 2025", students: 38, subject: "Chemistry", status: "Published", avgScore: 82 },
        { id: 4, name: "Biology Final Review", date: "Apr 28, 2025", students: 42, subject: "Biology", status: "Published", avgScore: 85 },
      ],
      []
    );
  
    const announcements = useMemo(
      () => [
        { id: "a1", title: "New Analytics Features", desc: "Track student progress with enhanced analytics and insights.", icon: BarChart3, date: "2d ago" },
        { id: "a2", title: "Contest Creation Tools", desc: "Host live academic competitions with new proctoring features.", icon: Trophy, date: "1w ago" },
        { id: "a3", title: "Staff Development", desc: "Monthly teaching strategies workshop on June 15th.", icon: Users, date: "Coming Soon" },
      ],
      []
    );
  
    const teacherStats = useMemo(
      () => ({
        activeStudents: 156,
        testsCreated: 24,
        avgEngagement: 92,
        pendingReviews: 8,
        contestsHosted: 3,
        classes: 6,
        avgTestScore: 81,
        completionRate: 94,
      }),
      []
    );
  
    const studentPerformance = useMemo(
      () => [
        { id: 1, name: "Sarah Johnson", avgScore: 94, improvement: "+8%", testsTaken: 12, status: "Excellent" },
        { id: 2, name: "Michael Chen", avgScore: 87, improvement: "+5%", testsTaken: 10, status: "Good" },
        { id: 3, name: "Emma Williams", avgScore: 72, improvement: "-3%", testsTaken: 8, status: "Needs Attention" },
        { id: 4, name: "David Brown", avgScore: 65, improvement: "+12%", testsTaken: 6, status: "Improving" },
      ],
      []
    );
  
    const focusAreas = useMemo(
      () => [
        { subject: "Physics", avgScore: 78, weakTopic: "Quantum Mechanics", studentsStruggling: 12 },
        { subject: "Mathematics", avgScore: 82, weakTopic: "Calculus", studentsStruggling: 8 },
        { subject: "Chemistry", avgScore: 75, weakTopic: "Organic Chemistry", studentsStruggling: 15 },
      ],
      []
    );
  
    // cursor-reactive background (disabled on mobile/low motion) – rAF throttled
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
    const goToTestManagement = useCallback(
      () => navigate("/dashboard/test-generator?tab=created"),
      [navigate]
    );
  
    const goToHostContest = useCallback(
      () => navigate("/dashboard/contest/create"),
      [navigate]
    );
  
    const goToStudentAnalytics = useCallback(
      () => navigate("/dashboard/students/analytics"),
      [navigate]
    );
  
    const handleBack = useCallback(() => {
      navigate(-1); // Go back to previous page
    }, [navigate]);
  
    const coins = profile?.coins ?? 200;
  
    // Get first name for personalized greeting
    const getFirstName = () => {
      if (!profile?.full_name) return "Teacher";
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
        {/* Scratch Card Popup (lazy) */}
        <Suspense fallback={null}>
          <ScratchCard isOpen={showScratchCard} onClose={closeScratch} coins={200} />
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
          {/* header - Mobile Responsive */}
          <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-30">
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-3">
              <div className="flex items-center justify-between">
                {/* Left Section - Back Button, Menu & Title */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  {/* Back Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 h-9 w-9 flex-shrink-0 hover:bg-gray-100/80 active:scale-95 transition-all"
                    onClick={handleBack}
                    aria-label="Go back"
                  >
                    <ArrowLeft size={18} className="text-gray-700" />
                  </Button>
  
                  {/* Mobile Menu Button */}
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
                      {getFirstName()}'s Dashboard <span className="text-muted-foreground">— Teacher</span>
                    </h1>
  
                    {/* Coin Balance - Mobile Responsive */}
                    <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0">
                      <Coins size={14} className="sm:size-4" />
                      <span className="hidden xs:inline">{coins} Educator Coins</span>
                      <span className="xs:hidden">{coins}</span>
                    </div>
  
                    {/* Teacher Badge */}
                    <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0">
                      <GraduationCap size={14} className="sm:size-4" />
                      <span className="hidden xs:inline">Teacher</span>
                    </div>
                  </div>
                </div>
  
                {/* Right Section - User Info & Logout */}
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
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="mx-auto max-w-7xl px-3 sm:px-4 space-y-4 sm:space-y-6"
            >
              {/* welcome card - Mobile Responsive */}
              <motion.div variants={item}>
                <Card className="border card-soft bg-gradient-to-r from-purple-50 to-pink-50">
                  <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle
                        className="text-[16px] sm:text-[18px] font-[650] tracking-[-0.01em] truncate"
                        style={{ color: INK }}
                      >
                        Welcome back, Professor {getFirstName()}! 👨‍🏫
                      </CardTitle>
                      <CardDescription
                        className="tracking-[-0.005em] text-xs sm:text-sm"
                        style={{ color: SLATE }}
                      >
                        Monitor student progress and enhance learning experiences with AI-powered tools.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                      <Link to="/dashboard/test-generator" className="flex-1 sm:flex-none min-w-0">
                        <Button className="gap-2 w-full sm:w-auto rounded-xl bg-gray-900 text-white hover:bg-black active:scale-[.98] shadow-lg text-xs sm:text-sm">
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="truncate">Create New Test</span>
                        </Button>
                      </Link>
  
                      <Button variant="outline" onClick={goToTestManagement} className="flex-1 sm:flex-none text-xs sm:text-sm">
                        <span className="truncate">Manage Tests</span>
                      </Button>
  
                      <Link to="/dashboard/contest/create" className="flex-1 sm:flex-none min-w-0">
                        <Button variant="ghost" className="gap-1 w-full sm:w-auto text-xs sm:text-sm">
                          <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="truncate">Host Contest</span>
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
  
              {/* Teacher KPIs - Mobile Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 sm:gap-4">
                <KpiCard title="Students" value={teacherStats.activeStudents} icon={Users} tone="blue" interactive={interactiveCards} />
                <KpiCard title="Tests" value={teacherStats.testsCreated} icon={FileText} tone="purple" interactive={interactiveCards} />
                <KpiCard title="Engagement" value={`${teacherStats.avgEngagement}%`} icon={TrendingUp} tone="green" interactive={interactiveCards} />
                <KpiCard title="To Review" value={teacherStats.pendingReviews} icon={CheckCircle} tone="amber" interactive={interactiveCards} />
                <KpiCard title="Contests" value={teacherStats.contestsHosted} icon={Trophy} tone="red" interactive={interactiveCards} />
                <KpiCard title="Classes" value={teacherStats.classes} icon={School} tone="indigo" interactive={interactiveCards} />
                <KpiCard title="Avg Score" value={`${teacherStats.avgTestScore}%`} icon={Target} tone="teal" interactive={interactiveCards} />
                <KpiCard title="Completion" value={`${teacherStats.completionRate}%`} icon={BarChart3} tone="emerald" interactive={interactiveCards} />
              </div>
  
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Left Column - Recent Tests & Student Performance */}
                <motion.div variants={item} className="lg:col-span-2 space-y-4 sm:space-y-6">
                  {/* Recent Tests - Mobile Optimized */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[14px] sm:text-[16px] font-[600] tracking-[-0.01em]" style={{ color: INK }}>
                        Recent Tests & Assignments
                      </h2>
                      <Button variant="ghost" size="sm" className="text-gray-900 dark:text-gray-50 text-xs sm:text-sm" onClick={goToTestManagement}>
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
                                  <Badge className="ml-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 shrink-0 text-xs">
                                    <Users className="h-3 w-3 mr-1" />
                                    {t.students}
                                  </Badge>
                                  {t.status === "Published" ? (
                                    <Badge className="ml-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 text-xs">
                                      {t.avgScore}% avg
                                    </Badge>
                                  ) : (
                                    <Badge className="ml-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0 text-xs">
                                      Draft
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  <span>{t.date}</span>
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end sm:justify-start">
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm flex-1 sm:flex-none">
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm hidden sm:inline-flex">
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
  
                  {/* Student Performance Analytics */}
                  <motion.div variants={item}>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            <CardTitle
                              className="text-sm sm:text-base font-[600] tracking-[-0.01em]"
                              style={{ color: INK }}
                            >
                              Student Performance Analytics
                            </CardTitle>
                          </div>
                          <Button variant="ghost" size="sm" className="text-gray-900 dark:text-gray-50 text-xs sm:text-sm" onClick={goToStudentAnalytics}>
                            Detailed View
                          </Button>
                        </div>
                        <CardDescription className="text-xs sm:text-sm">Top performing students & areas needing attention</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {studentPerformance.map((student) => (
                          <div key={student.id} className="p-3 border rounded-lg hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  student.status === "Excellent" ? "bg-emerald-500/10 text-emerald-700" :
                                  student.status === "Good" ? "bg-blue-500/10 text-blue-700" :
                                  student.status === "Improving" ? "bg-amber-500/10 text-amber-700" :
                                  "bg-red-500/10 text-red-700"
                                }`}>
                                  <span className="font-bold">{student.avgScore}</span>
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm sm:text-base" style={{ color: INK }}>{student.name}</h4>
                                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                                    <Badge variant="outline" className={`text-xs ${
                                      student.improvement.startsWith('+') ? "border-emerald-600 text-emerald-700" :
                                      "border-red-600 text-red-700"
                                    }`}>
                                      {student.improvement}
                                    </Badge>
                                    <span>{student.testsTaken} tests</span>
                                  </div>
                                </div>
                              </div>
                              <Badge className={
                                student.status === "Excellent" ? "bg-emerald-500/10 text-emerald-700" :
                                student.status === "Good" ? "bg-blue-500/10 text-blue-700" :
                                student.status === "Improving" ? "bg-amber-500/10 text-amber-700" :
                                "bg-red-500/10 text-red-700"
                              }>
                                {student.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
  
                {/* Right Column */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Announcements - Mobile Optimized */}
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
                        <CardDescription className="text-xs sm:text-sm">Latest features and updates</CardDescription>
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
  
                  {/* Focus Areas */}
                  <motion.div variants={item}>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          <CardTitle
                            className="text-sm sm:text-base font-[600] tracking-[-0.01em]"
                            style={{ color: INK }}
                          >
                            Focus Areas
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs sm:text-sm">Topics needing attention</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {focusAreas.map((area, index) => (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm sm:text-base" style={{ color: INK }}>{area.subject}</h4>
                              <span className="text-lg font-bold" style={{ color: INK }}>{area.avgScore}%</span>
                            </div>
                            <div className="space-y-1 text-xs sm:text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Weak Topic:</span>
                                <span style={{ color: INK }}>{area.weakTopic}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Students Struggling:</span>
                                <Badge variant="outline" className="border-red-600 text-red-700">
                                  {area.studentsStruggling} students
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full text-xs sm:text-sm">
                          <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          Create Remedial Content
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
  
                  {/* Quick Actions */}
                  <motion.div variants={item}>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle
                          className="text-sm sm:text-base font-[600] tracking-[-0.01em]"
                          style={{ color: INK }}
                        >
                          Quick Actions
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Access your teaching tools faster</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Link to="/dashboard/students">
                          <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>Manage Students</span>
                          </Button>
                        </Link>
                        <Button 
                          onClick={goToHostContest}
                          variant="outline" 
                          className="w-full justify-start gap-2 text-xs sm:text-sm"
                        >
                          <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>Host Contest</span>
                        </Button>
                        <Link to="/dashboard/notes">
                          <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                            <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>Teaching Resources</span>
                          </Button>
                        </Link>
                        <Link to="/dashboard/analytics">
                          <Button variant="outline" className="w-full justify-start gap-2 text-xs sm:text-sm">
                            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>View Analytics</span>
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </div>
  
              {/* CTA - Mobile Responsive */}
              <motion.div
                variants={item}
                className="rounded-xl sm:rounded-2xl border p-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.06)]"
              >
                <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 px-4 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-white">
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[16px] sm:text-[18px] font-[600] tracking-[-0.01em] truncate"
                    >
                      🏆 Ready to Inspire?
                    </div>
                    <div className="text-sm opacity-90">
                      Host a live academic contest and engage your students with interactive challenges!
                    </div>
                  </div>
                  <Link to="/dashboard/contest/create" className="w-full sm:w-auto">
                    <Button className="gap-2 w-full sm:w-auto rounded-xl bg-white text-purple-600 hover:bg-gray-100 active:scale-[.98] shadow-lg text-xs sm:text-sm">
                      <Rocket className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Host Contest Now</span>
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </main>
        </div>
      </div>
    );
  }
  
  /* ------- KPI Card - Mobile Responsive (memoized) ------- */
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
    tone?: "blue" | "green" | "purple" | "amber" | "red" | "indigo" | "teal" | "emerald";
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
      green: { border: "from-green-400/45 to-green-500/45", chip: "bg-green-500/10 text-green-700" },
      purple: { border: "from-purple-400/45 to-purple-500/45", chip: "bg-purple-500/10 text-purple-700" },
      amber: { border: "from-amber-400/45 to-orange-400/45", chip: "bg-amber-500/10 text-amber-700" },
      red: { border: "from-red-400/45 to-red-500/45", chip: "bg-red-500/10 text-red-700" },
      indigo: { border: "from-indigo-400/45 to-indigo-500/45", chip: "bg-indigo-500/10 text-indigo-700" },
      teal: { border: "from-teal-400/45 to-cyan-400/45", chip: "bg-teal-500/10 text-teal-700" },
      emerald: { border: "from-emerald-400/45 to-emerald-500/45", chip: "bg-emerald-500/10 text-emerald-700" },
    } as const;
    const t = TONES[tone] || TONES.blue;
  
    return (
      <div onMouseMove={onMove} onMouseLeave={resetPos} style={{ perspective: 1000 }}>
        <motion.div
          style={interactive ? { rotateX, rotateY } : undefined}
          whileHover={!interactive ? ({ scale: 1.01 } as any) : undefined}
          className="relative rounded-xl sm:rounded-2xl border bg-card card-soft transition-all shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_20px-rgba(0,0,0,0.05)] p-[1px]"
        >
          {/* ultra-thin gradient border */}
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