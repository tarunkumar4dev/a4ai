// src/pages/DashboardPage.tsx
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BellDot,
  Flame,
  Plus,
  Rocket,
  TimerReset,
  TrendingUp,
  FileText,
  Zap,
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
  const { profile, loading } = useUserProfile();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const isCoarse = useCoarse();
  const interactiveCards = !(isMobile || isCoarse || prefersReducedMotion);

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
      {interactiveCards && (
        <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: bgGlow }} />
      )}
      <div className="fixed inset-0 -z-20 opacity-[0.035] dark:opacity-[0.03] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* header */}
        <header className="bg-background/80 backdrop-blur border-b sticky top-0 z-10">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-3 flex items-center justify-between">
            <h1 className="text-[21px] sm:text-[24px] font-[700] tracking-[-0.012em] leading-tight" style={{ color: INK }}>
              Dashboard <span className="text-muted-foreground">— {roleLabel}</span>
            </h1>
            <div className="flex items-center gap-2 sm:gap-4 text-sm">
              <div className="hidden sm:block text-muted-foreground max-w-[45vw] truncate">
                {profile?.full_name} {profile?.email ? `(${profile.email})` : ""}
              </div>
              <Button
                onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
                variant="destructive"
                size="sm"
              >
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto py-5 sm:py-6">
          <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-7xl px-3 sm:px-4 space-y-5 sm:space-y-6">
            {/* welcome */}
            <motion.div variants={item}>
              <Card className="border card-soft">
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle className="text-[18px] font-[650] tracking-[-0.01em]" style={{ color: INK }}>
                      Welcome back, {profile?.full_name || "there"}!
                    </CardTitle>
                    <CardDescription className="tracking-[-0.005em]" style={{ color: SLATE }}>
                      Generate curriculum-perfect tests with AI. Pick a quick action to get started.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/dashboard/test-generator">
                      <Button
                        className="gap-2 w-full sm:w-auto rounded-xl bg-gray-900 text-white hover:bg-black active:scale-[.98] shadow-lg"
                      >
                        <Rocket className="h-4 w-4" /> Create a Test Paper
                      </Button>
                    </Link>

                    <Link to="/dashboard/history">
                      <Button variant="outline">View History</Button>
                    </Link>
                    <Link to="/dashboard/subscription">
                      <Button variant="ghost" className="gap-1">
                        <Zap className="h-4 w-4" /> Upgrade
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KpiCard title="Tests Generated" value={recentTests.length} icon={FileText} tone="blue" interactive={interactiveCards} />
              <KpiCard title="Avg. Time to Paper" value="01:42" icon={TimerReset} tone="teal" interactive={interactiveCards} />
              <KpiCard title="Syllabus Match" value="99%" icon={TrendingUp} tone="blue" interactive={interactiveCards} />
              <KpiCard title="Streak" value={profile?.streak ?? 3} icon={Flame} tone="amber" interactive={interactiveCards} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* recent tests */}
              <motion.div variants={item} className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-[600] tracking-[-0.01em]" style={{ color: INK }}>Recent Tests</h2>
                  <Link to="/dashboard/history">
                    <Button variant="ghost" size="sm" className="text-gray-900 dark:text-gray-50">View All</Button>
                  </Link>
                </div>
                <AnimatePresence initial={false}>
                  {recentTests.map((t) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="group">
                      <Card className="border">
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${t.subject === "Physics" ? "bg-red-400"
                                : t.subject === "Mathematics" ? "bg-sky-400"
                                  : "bg-emerald-400"
                                }`} />
                              <h3 className="font-[600] tracking-[-0.01em] truncate" style={{ color: INK }}>{t.name}</h3>
                              <Badge variant="secondary" className="ml-1 shrink-0">{t.subject}</Badge>
                              {t.status === "Ready" ? (
                                <Badge className="ml-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0">Ready</Badge>
                              ) : (
                                <Badge className="ml-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">Draft</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{t.date} • {t.questions} questions</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="sm:w-auto w-full">View</Button>
                            <Button variant="outline" size="sm" className="hidden sm:inline-flex">Edit</Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {/* announcements */}
              <motion.div variants={item}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <BellDot className="h-4 w-4" />
                      <CardTitle className="text-base font-[600] tracking-[-0.01em]" style={{ color: INK }}>
                        Announcements
                      </CardTitle>
                    </div>
                    <CardDescription>What’s new in a4ai</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {announcements.map((a) => (
                      <div key={a.id} className="rounded-lg border bg-muted/40 p-3">
                        <div className="flex items-center gap-2 font-medium"><a.icon className="h-4 w-4" /> {a.title}</div>
                        <div className="text-sm text-muted-foreground">{a.desc}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{a.date}</div>
                      </div>
                    ))}
                    <Link to="/changelog">
                      <Button variant="ghost" className="w-full">See changelog</Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* CTA */}
            <motion.div variants={item} className="rounded-2xl border p-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.06)]">
              <div className="rounded-2xl bg-card card-soft px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-[18px] font-[600] tracking-[-0.01em]" style={{ color: INK }}>Host a live contest</div>
                  <div className="text-sm text-muted-foreground">Proctor with camera checks, rankings and exports.</div>
                </div>
                <Link to="/dashboard/contest/create">
                  <Button
                    className="gap-2 w-full sm:w-auto rounded-xl bg-gray-900 text-white hover:bg-black active:scale-[.98] shadow-lg"
                  >
                    <Rocket className="h-4 w-4" /> Create contest
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

/* ------- KPI Card (glossy blue, no purple) ------- */
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

  // glossy blue gradients (matches hero: #76B6FF → #2F6DF4)
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
        className="relative rounded-2xl border bg-card card-soft transition-all shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_30px_rgba(0,0,0,0.05)] p-[1px]"
      >
        {/* ultra-thin gradient border */}
        <div className={`rounded-2xl bg-gradient-to-tr ${t.border} p-0.5`}>
          <div className="rounded-2xl bg-card/95 backdrop-blur px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground tracking-[-0.005em]">{title}</div>
              <div className={`p-2 rounded-lg ${t.chip}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 text-[28px] sm:text-[30px] leading-none font-[700] tracking-[-0.015em] num" style={{ color: INK }}>
              {value}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
