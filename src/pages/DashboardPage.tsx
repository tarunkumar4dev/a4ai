// src/pages/DashboardPage.tsx
import { useEffect, useState, useMemo } from "react";
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
import ScratchCard from "@/components/ScratchCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  X,
  ArrowLeft
} from "lucide-react";

/* ------------ tiny media hook ------------ */
function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
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

/* ------------ animations ------------ */
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const isCoarse = useCoarse();
  const interactiveCards = !(isMobile || isCoarse || prefersReducedMotion);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Scratch Card State
  const [showScratchCard, setShowScratchCard] = useState(false);

  // Check if new user and show coins popup
  useEffect(() => {
    const checkNewUserAndCoins = async () => {
      const isNewUser = searchParams.get('newUser') === 'true';
      const storedHasSeenPopup = localStorage.getItem('hasSeenCoinPopup');
      
      // Check if user has coins but hasn't seen popup
      if (profile && profile.coins && profile.coins >= 100 && !storedHasSeenPopup) {
        setTimeout(() => {
          setShowScratchCard(true);
        }, 1500);
      }
      
      // Also show for new users coming from signup
      if (isNewUser && !storedHasSeenPopup) {
        setTimeout(() => {
          setShowScratchCard(true);
        }, 2000);
      }
    };

    if (!loading && profile) {
      checkNewUserAndCoins();
    }
  }, [profile, loading, searchParams]);

  // Handle scratch card close
  const handleScratchCardClose = () => {
    setShowScratchCard(false);
    localStorage.setItem('hasSeenCoinPopup', 'true');
  };

  // single helper to go to Test Generator → History tab
  const goToHistory = () => navigate("/dashboard/test-generator?tab=history");

  // Handle back navigation
  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  /* ensure profile */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        navigate("/login");
        return;
      }
      const { data: existing, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (mounted && !existing && !error) {
        await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || "User",
          role: "student",
          coins: 100,
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // demo data (memoized)
  const { recentTests, announcements } = useMemo(
    () => ({
      recentTests: [
        { id: 1, name: "Physics Midterm", date: "May 14, 2025", questions: 15, subject: "Physics", status: "Ready" },
        { id: 2, name: "Calculus Quiz", date: "May 10, 2025", questions: 10, subject: "Mathematics", status: "Draft" },
        { id: 3, name: "Chemistry Practice", date: "May 02, 2025", questions: 12, subject: "Chemistry", status: "Ready" },
      ],
      announcements: [
        { id: "a1", title: "New: Blueprint Editor", desc: "Lock marks, difficulty and outcome mix before generation.", icon: Rocket, date: "2d ago" },
        { id: "a2", title: "Contest Host Beta", desc: "Schedule live, proctored contests with rankings.", icon: Rocket, date: "1w ago" },
      ],
    }),
    []
  );

  // cursor-reactive background (disabled on mobile/low motion)
  const mx = useMotionValue(320), my = useMotionValue(160);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!interactiveCards) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const bgGlow = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, rgba(47,58,68,.08), transparent 70%)
  `;

  const roleLabel = profile?.role ? profile.role[0].toUpperCase() + profile.role.slice(1) : "User";

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
      <ScratchCard 
        isOpen={showScratchCard}
        onClose={handleScratchCardClose}
        coins={100}
      />

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
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <DashboardSidebar onClose={() => setMobileSidebarOpen(false)} />
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
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu size={18} />
                </Button>

                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <h1 className="text-[18px] sm:text-[24px] font-[700] tracking-[-0.012em] leading-tight truncate" style={{ color: INK }}>
                    Dashboard <span className="text-muted-foreground">— {roleLabel}</span>
                  </h1>
                  
                  {/* Coin Balance - Mobile Responsive */}
                  <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0">
                    <Coins size={14} className="sm:size-4" />
                    <span className="hidden xs:inline">{profile?.coins || 100} Coins</span>
                    <span className="xs:hidden">{profile?.coins || 100}</span>
                  </div>
                </div>
              </div>

              {/* Right Section - User Info & Logout */}
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <div className="hidden sm:block text-muted-foreground max-w-[120px] lg:max-w-[200px] truncate text-sm">
                  {profile?.full_name} {profile?.email ? `(${profile.email})` : ""}
                </div>
                <Button
                  onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
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
          <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-7xl px-3 sm:px-4 space-y-4 sm:space-y-6">
            {/* welcome card - Mobile Responsive */}
            <motion.div variants={item}>
              <Card className="border card-soft">
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-[16px] sm:text-[18px] font-[650] tracking-[-0.01em] truncate" style={{ color: INK }}>
                      Welcome back, {profile?.full_name || "there"}!
                    </CardTitle>
                    <CardDescription className="tracking-[-0.005em] text-xs sm:text-sm" style={{ color: SLATE }}>
                      Generate curriculum-perfect tests with AI. Pick a quick action to get started.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                    <Link to="/dashboard/test-generator" className="flex-1 sm:flex-none min-w-0">
                      <Button
                        className="gap-2 w-full sm:w-auto rounded-xl bg-gray-900 text-white hover:bg-black active:scale-[.98] shadow-lg text-xs sm:text-sm"
                      >
                        <Rocket className="h-3 w-3 sm:h-4 sm:w-4" /> 
                        <span className="truncate">Create Test</span>
                      </Button>
                    </Link>

                    <Button variant="outline" onClick={goToHistory} className="flex-1 sm:flex-none text-xs sm:text-sm">
                      <span className="truncate">History</span>
                    </Button>

                    <Link to="/pricing" className="flex-1 sm:flex-none min-w-0">
                      <Button variant="ghost" className="gap-1 w-full sm:w-auto text-xs sm:text-sm">
                        <Zap className="h-3 w-3 sm:h-4 sm:w-4" /> 
                        <span className="truncate">Upgrade</span>
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>

            {/* KPIs - Mobile Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <KpiCard title="Tests" value={recentTests.length} icon={FileText} tone="blue" interactive={interactiveCards} />
              <KpiCard title="Avg. Time" value="01:42" icon={TimerReset} tone="teal" interactive={interactiveCards} />
              <KpiCard title="Syllabus" value="99%" icon={TrendingUp} tone="blue" interactive={interactiveCards} />
              <KpiCard title="Streak" value={profile?.streak ?? 3} icon={Flame} tone="amber" interactive={interactiveCards} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* recent tests - Mobile Optimized */}
              <motion.div variants={item} className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] sm:text-[16px] font-[600] tracking-[-0.01em]" style={{ color: INK }}>Recent Tests</h2>
                  <Button variant="ghost" size="sm" className="text-gray-900 dark:text-gray-50 text-xs sm:text-sm" onClick={goToHistory}>
                    View All
                  </Button>
                </div>
                <AnimatePresence initial={false}>
                  {recentTests.map((t) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="group">
                      <Card className="border">
                        <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.subject === "Physics" ? "bg-red-400"
                                : t.subject === "Mathematics" ? "bg-sky-400"
                                  : "bg-emerald-400"
                                }`} />
                              <h3 className="font-[600] tracking-[-0.01em] truncate text-sm sm:text-base" style={{ color: INK }}>{t.name}</h3>
                              <Badge variant="secondary" className="ml-1 shrink-0 text-xs">{t.subject}</Badge>
                              {t.status === "Ready" ? (
                                <Badge className="ml-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 text-xs">Ready</Badge>
                              ) : (
                                <Badge className="ml-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0 text-xs">Draft</Badge>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{t.date} • {t.questions} questions</p>
                          </div>
                          <div className="flex gap-2 justify-end sm:justify-start">
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm flex-1 sm:flex-none">View</Button>
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm hidden sm:inline-flex">Edit</Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {/* announcements - Mobile Optimized */}
              <motion.div variants={item}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <BellDot className="h-4 w-4" />
                      <CardTitle className="text-sm sm:text-base font-[600] tracking-[-0.01em]" style={{ color: INK }}>
                        Announcements
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs sm:text-sm">What's new in a4ai</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    {announcements.map((a) => (
                      <div key={a.id} className="rounded-lg border bg-muted/40 p-2 sm:p-3">
                        <div className="flex items-center gap-2 font-medium text-sm sm:text-base">
                          <a.icon className="h-3 w-3 sm:h-4 sm:w-4" /> 
                          <span className="truncate">{a.title}</span>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{a.desc}</div>
                        <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground">{a.date}</div>
                      </div>
                    ))}
                    <Link to="/changelog">
                      <Button variant="ghost" className="w-full text-xs sm:text-sm">See changelog</Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* CTA - Mobile Responsive */}
            <motion.div variants={item} className="rounded-xl sm:rounded-2xl border p-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.06)]">
              <div className="rounded-xl sm:rounded-2xl bg-card card-soft px-4 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] sm:text-[18px] font-[600] tracking-[-0.01em] truncate" style={{ color: INK }}>Host a live contest</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Proctor with camera checks, rankings and exports.</div>
                </div>
                <Link to="/dashboard/contest/create" className="w-full sm:w-auto">
                  <Button
                    className="gap-2 w-full sm:w-auto rounded-xl bg-gray-900 text-white hover:bg-black active:scale-[.98] shadow-lg text-xs sm:text-sm"
                  >
                    <Rocket className="h-3 w-3 sm:h-4 sm:w-4" /> 
                    <span>Create contest</span>
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

/* ------- KPI Card - Mobile Responsive ------- */
function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "blue",
  interactive,
}: {
  title: string;
  value: string | number;
  icon: any;
  tone?: "blue" | "teal" | "amber";
  interactive: boolean;
}) {
  const mx = useMotionValue(60), my = useMotionValue(40);
  const rotateX = useTransform(my, [0, 120], [6, -6]);
  const rotateY = useTransform(mx, [0, 180], [-8, 8]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const TONES = {
    blue: { border: "from-[#76B6FF66] to-[#2F6DF466]", chip: "bg-[#E8F1FF] text-[#1E3A8A]" },
    teal: { border: "from-teal-400/45 to-cyan-400/45", chip: "bg-teal-500/10 text-teal-700" },
    amber: { border: "from-amber-400/45 to-orange-400/45", chip: "bg-amber-500/10 text-amber-700" },
  } as const;
  const t = TONES[tone];

  return (
    <div onMouseMove={onMove} onMouseLeave={() => { mx.set(60); my.set(40); }} style={{ perspective: 1000 }}>
      <motion.div
        style={interactive ? { rotateX, rotateY } : undefined}
        whileHover={!interactive ? { scale: 1.01 } : undefined}
        className="relative rounded-xl sm:rounded-2xl border bg-card card-soft transition-all shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.05)] p-[1px]"
      >
        {/* ultra-thin gradient border */}
        <div className={`rounded-xl sm:rounded-2xl bg-gradient-to-tr ${t.border} p-0.5`}>
          <div className="rounded-xl sm:rounded-2xl bg-card/95 backdrop-blur px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-muted-foreground tracking-[-0.005em] truncate">{title}</div>
              <div className={`p-1 sm:p-2 rounded-lg ${t.chip}`}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            <div className="mt-1 sm:mt-2 text-[20px] sm:text-[30px] leading-none font-[700] tracking-[-0.015em] num" style={{ color: INK }}>
              {value}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}