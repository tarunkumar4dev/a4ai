import { useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  AnimatePresence,
} from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";

import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ArrowRight,
  FileText,
  Zap,
  BarChart2,
  ChevronRight,
  Clock,
  ShieldCheck,
  Trophy,
  CheckCircle2,
} from "lucide-react";

/*
  DashboardPage — a4ai
  "Cool + impressive" upgrade
  - Animated hero band with cursor‑reactive glow
  - Welcome card with quick actions
  - KPI cards with subtle motion
  - Recent activity list with hover lift
  - Polished empty states
  - Safe profile bootstrapping for Supabase
*/

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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
  ];

  // cursor‑reactive page glow
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="animate-pulse text-sm text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "User";

  return (
    <div className="flex h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900" onMouseMove={onMove}>
      {/* ambient background */}
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: bgGlow }} />
      <div className="fixed inset-0 -z-20 bg-[url('/images/grid.svg')] opacity-[0.05] dark:opacity-[0.03]" />

      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/70 dark:bg-gray-900/60 backdrop-blur border-b border-gray-100 dark:border-white/10 p-4 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-[linear-gradient(90deg,#4f46e5_0%,#a855f7_50%,#ec4899_100%)] bg-[length:200%_100%] animate-[bg-pan_10s_linear_infinite]">
              Dashboard — {roleLabel}
            </h1>
            <div className="flex items-center gap-4 text-sm">
              <div className="hidden sm:block text-muted-foreground">
                {profile?.full_name} {profile?.email ? `(${profile.email})` : ""}
              </div>
              <Button onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }} variant="destructive" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto py-6">
          <motion.div variants={container} initial="hidden" animate="show" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Welcome */}
            <motion.div variants={item}>
              <Card className="border border-gray-100 dark:border-white/10 shadow-sm bg-white/80 dark:bg-gray-900/70 backdrop-blur">
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Welcome back, {profile?.full_name || "there"}!</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Generate curriculum‑perfect tests with AI. Pick a quick action to get started.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/dashboard/test-generator">
                      <Button className="group bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow hover:shadow-md">
                        <Plus className="mr-2 h-4 w-4" /> Create New Test
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <Link to="/dashboard/history">
                      <Button variant="outline">View History</Button>
                    </Link>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <motion.div variants={item}>
                <Card className="hover:shadow-md transition border border-gray-100 dark:border-white/10">
                  <CardHeader className="flex flex-row justify-between items-center pb-2">
                    <CardTitle className="text-sm">Tests Generated</CardTitle>
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"><FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{recentTests.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">This month</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="hover:shadow-md transition border border-gray-100 dark:border-white/10">
                  <CardHeader className="flex flex-row justify-between items-center pb-2">
                    <CardTitle className="text-sm">Usage</CardTitle>
                    <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg"><BarChart2 className="h-5 w-5 text-purple-600 dark:text-purple-400" /></div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">7/10</div>
                    <p className="text-xs text-muted-foreground mt-1">Free tests remaining</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted"><div className="h-2 w-7/10 bg-gradient-to-r from-indigo-600 to-purple-600" /></div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 hover:shadow transition bg-indigo-50/40 dark:bg-indigo-500/5">
                  <CardHeader>
                    <CardTitle className="text-sm flex gap-2 items-center">
                      <Zap className="h-4 w-4 text-amber-400" /> Upgrade to Premium
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Unlimited tests & advanced features.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to="/dashboard/subscription">
                      <Button variant="outline" className="w-full border-indigo-300 text-indigo-600 dark:text-indigo-400">View Plans</Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Tests */}
            <motion.div variants={item} className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Recent Tests</h2>
                <Link to="/dashboard/history">
                  <Button variant="ghost" size="sm" className="text-indigo-600 dark:text-indigo-400">
                    View All <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {recentTests.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                      No tests yet. Create your first test to see it here.
                    </motion.div>
                  ) : (
                    recentTests.map((test) => (
                      <motion.div key={test.id} whileHover={{ y: -2 }} transition={{ duration: 0.12 }} className="group">
                        <Card className="border border-gray-100 dark:border-white/10 group-hover:border-indigo-100 dark:group-hover:border-indigo-500/40 transition">
                          <div className="p-4 flex justify-between items-center">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${test.subject === "Physics" ? "bg-red-400" : "bg-blue-400"}`} />
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
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
