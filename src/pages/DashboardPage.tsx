import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";

import DashboardSidebar from "@/components/DashboardSidebar";
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
  ArrowRight,
  BarChart2,
  BellDot,
  CalendarDays,
  CheckCircle2,
  FileText,
  Flame,
  Plus,
  Rocket,
  Sparkles,
  TimerReset,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

/*
  DashboardPage — next‑level polish
  - Parallax glow background, animated header
  - KPI cards with tilt + live counter
  - Activity timeline + announcements
  - Quick actions and shortcuts row
  - Gradient CTA band
  - Dark‑mode perfect, no new deps
*/

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile, loading } = useUserProfile();

  // ensure profile after login
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        navigate("/login");
        return;
      }
      const { data: existing, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (mounted && !existing && !fetchError) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || "User",
          role: "student",
        });
        if (insertError) console.error("Error creating profile:", insertError.message);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Demo data — replace with API
  const recentTests = [
    { id: 1, name: "Physics Midterm", date: "May 14, 2025", questions: 15, subject: "Physics", status: "Ready" },
    { id: 2, name: "Calculus Quiz", date: "May 10, 2025", questions: 10, subject: "Mathematics", status: "Draft" },
    { id: 3, name: "Chemistry Practice", date: "May 02, 2025", questions: 12, subject: "Chemistry", status: "Ready" },
  ];
  const announcements = [
    { id: "a1", title: "New: Blueprint Editor", desc: "Lock marks, difficulty and outcome mix before generation.", icon: Rocket, date: "2d ago" },
    { id: "a2", title: "Contest Host Beta", desc: "Schedule live, proctored contests with rankings.", icon: Sparkles, date: "1w ago" },
  ];

  // cursor‑reactive background glow
  const mx = useMotionValue(320);
  const my = useMotionValue(160);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const bgGlow = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, hsl(var(--primary)/0.10), transparent 70%),
    radial-gradient(800px 400px at calc(${mx}px + 220px) calc(${my}px + 140px), hsl(var(--primary)/0.08), transparent 70%)
  `;

  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "User";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="animate-pulse text-sm text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900" onMouseMove={onMove}>
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: bgGlow }} />
      <div className="fixed inset-0 -z-20 bg-[url('/images/grid.svg')] opacity-[0.05] dark:opacity-[0.03]" />

      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/70 dark:bg-gray-900/60 backdrop-blur border-b border-gray-100 dark:border-white/10 p-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-[linear-gradient(90deg,#4f46e5_0%,#a855f7_50%,#ec4899_100%)] bg-[length:200%_100%] animate-[bg-pan_10s_linear_infinite]">
              Dashboard — {roleLabel}
            </h1>
            <div className="flex items-center gap-4 text-sm">
              <div className="hidden sm:block text-muted-foreground">
                {profile?.full_name} {profile?.email ? `(${profile.email})` : ""}
              </div>
              <Button onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }} variant="destructive" size="sm">Logout</Button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto py-6">
          <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Welcome band + quick actions */}
            <motion.div variants={item}>
              <Card className="border border-gray-100 dark:border-white/10 shadow-sm bg-white/80 dark:bg-gray-900/70 backdrop-blur overflow-hidden">
                <div className="relative">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent dark:via-white/10" />
                  <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Welcome back, {profile?.full_name || "there"}!</CardTitle>
                      <CardDescription className="text-muted-foreground">Generate curriculum‑perfect tests with AI. Pick a quick action to get started.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to="/dashboard/test-generator">
                        <Button className="group bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow hover:shadow-md">
                          <Plus className="mr-2 h-4 w-4" /> Create New Test
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                      <Link to="/dashboard/history"><Button variant="outline">View History</Button></Link>
                      <Link to="/dashboard/subscription"><Button variant="ghost" className="gap-1"><Zap className="h-4 w-4"/> Upgrade</Button></Link>
                    </div>
                  </CardHeader>
                </div>
              </Card>
            </motion.div>

            {/* KPI row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Tests Generated" value={recentTests.length} icon={FileText} accent="from-indigo-600 to-purple-600" />
              <KpiCard title="Avg. Time to Paper" value="01:42" icon={TimerReset} accent="from-emerald-500 to-teal-500" />
              <KpiCard title="Syllabus Match" value="99%" icon={TrendingUp} accent="from-fuchsia-500 to-pink-500" />
              <KpiCard title="Streak" value={profile?.streak ?? 3} icon={Flame} accent="from-amber-500 to-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Recent tests list */}
              <motion.div variants={item} className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Recent Tests</h2>
                  <Link to="/dashboard/history">
                    <Button variant="ghost" size="sm" className="text-indigo-600 dark:text-indigo-400">View All</Button>
                  </Link>
                </div>
                <AnimatePresence initial={false}>
                  {recentTests.map((test) => (
                    <motion.div key={test.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="group">
                      <Card className="border border-gray-100 dark:border-white/10 group-hover:border-indigo-100 dark:group-hover:border-indigo-500/40 transition">
                        <div className="p-4 flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${test.subject === "Physics" ? "bg-red-400" : test.subject === "Mathematics" ? "bg-blue-400" : "bg-emerald-400"}`} />
                              <h3 className="font-medium">{test.name}</h3>
                              <Badge variant="secondary" className="ml-1">{test.subject}</Badge>
                              {test.status === "Ready" ? (
                                <Badge className="ml-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Ready</Badge>
                              ) : (
                                <Badge className="ml-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">Draft</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{test.date} • {test.questions} questions</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">View</Button>
                            <Button variant="outline" size="sm">Edit</Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {/* Right: announcements */}
              <motion.div variants={item}>
                <Card className="h-full border border-gray-100 dark:border-white/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2"><BellDot className="h-4 w-4"/><CardTitle className="text-base">Announcements</CardTitle></div>
                    <CardDescription>What’s new in a4ai</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {announcements.map((a) => (
                      <div key={a.id} className="rounded-lg border bg-muted/40 p-3">
                        <div className="flex items-center gap-2 font-medium"><a.icon className="h-4 w-4"/> {a.title}</div>
                        <div className="text-sm text-muted-foreground">{a.desc}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{a.date}</div>
                      </div>
                    ))}
                    <Link to="/changelog"><Button variant="ghost" className="w-full">See changelog</Button></Link>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* CTA band */}
            <motion.div variants={item} className="rounded-2xl border bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-[1px] shadow-lg">
              <div className="rounded-2xl bg-background/70 px-6 py-6 backdrop-blur flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold tracking-tight">Host a live contest</div>
                  <div className="text-sm text-muted-foreground">Proctor with camera checks, rankings and exports.</div>
                </div>
                <Link to="/dashboard/contest/create"><Button className="gap-2 text-white"><Rocket className="h-4 w-4"/> Create contest</Button></Link>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/* ------- pieces ------- */
function KpiCard({ title, value, icon: Icon, accent }: { title: string; value: string | number; icon: any; accent: string }) {
  const mx = useMotionValue(60);
  const my = useMotionValue(40);
  const rotateX = useTransform(my, [0, 120], [6, -6]);
  const rotateY = useTransform(mx, [0, 180], [-8, 8]);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  return (
    <div onMouseMove={onMove} onMouseLeave={() => { mx.set(60); my.set(40); }} style={{ perspective: 1000 }} className="group">
      <motion.div style={{ rotateX, rotateY }} className="relative h-full rounded-2xl border bg-gradient-to-b from-background to-muted/40 p-5 shadow-sm transition-all">
        <div aria-hidden className={`pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-transparent [background:linear-gradient(theme(colors.background),theme(colors.background))_padding-box,linear-gradient(90deg,var(--tw-gradient-from),var(--tw-gradient-to))_border-box] [border:1px_solid_transparent] opacity-90 bg-gradient-to-r ${accent}`} />
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: useMotionTemplate`radial-gradient(120px_80px_at_${mx}px_${my}px,hsl(var(--primary)/0.12),transparent_70%)` }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="p-2 rounded-lg bg-muted/60"><Icon className="h-5 w-5"/></div>
          </div>
          <div className="mt-2 text-3xl font-extrabold">{value}</div>
        </div>
      </motion.div>
    </div>
  );
}
