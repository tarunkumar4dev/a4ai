// src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";

import DashboardSidebar from "@/components/DashboardSidebar";
import ScratchCard from "@/components/ScratchCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BellDot, Flame, Rocket, TimerReset, TrendingUp, FileText, Zap, Coins } from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  
  // ✅ Simple Scratch Card State
  const [showScratchCard, setShowScratchCard] = useState(false);

  // ✅ Simple Effect - Sirf new user check karo
  useEffect(() => {
    const isNewUser = searchParams.get('newUser') === 'true';
    const hasSeenPopup = localStorage.getItem('hasSeenCoinPopup');
    
    if (isNewUser && !hasSeenPopup) {
      // 2 second baad popup dikhao
      setTimeout(() => {
        setShowScratchCard(true);
      }, 2000);
    }
  }, [searchParams]);

  // ✅ Simple Close Function
  const handleScratchCardClose = () => {
    setShowScratchCard(false);
    localStorage.setItem('hasSeenCoinPopup', 'true');
  };

  const goToHistory = () => navigate("/dashboard/test-generator?tab=history");

  // Demo data
  const recentTests = [
    { id: 1, name: "Physics Midterm", date: "May 14, 2025", questions: 15, subject: "Physics", status: "Ready" },
    { id: 2, name: "Calculus Quiz", date: "May 10, 2025", questions: 10, subject: "Mathematics", status: "Draft" },
    { id: 3, name: "Chemistry Practice", date: "May 02, 2025", questions: 12, subject: "Chemistry", status: "Ready" },
  ];

  const announcements = [
    { id: "a1", title: "New: Blueprint Editor", desc: "Lock marks, difficulty and outcome mix before generation.", date: "2d ago" },
    { id: "a2", title: "Contest Host Beta", desc: "Schedule live, proctored contests with rankings.", date: "1w ago" },
  ];

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-gradient-to-b from-gray-50 to-white">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-[#DFE4EF]">
      {/* ✅ Scratch Card Popup - Simple */}
      <ScratchCard 
        isOpen={showScratchCard}
        onClose={handleScratchCardClose}
        coins={100}
      />

      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-10">
          <div className="mx-auto w-full max-w-7xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Dashboard <span className="text-muted-foreground">— Student</span>
              </h1>
              
              {/* Coin Balance - Hardcoded dikhao */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                <Coins size={16} />
                <span>100 Coins</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="text-muted-foreground">
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

        <main className="flex-1 overflow-y-auto py-6">
          <div className="mx-auto max-w-7xl px-4 space-y-6">
            {/* Welcome Card */}
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl font-bold">
                    Welcome back, {profile?.full_name || "there"}!
                  </CardTitle>
                  <CardDescription>
                    Generate curriculum-perfect tests with AI. Pick a quick action to get started.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/dashboard/test-generator">
                    <Button className="gap-2 bg-gray-900 text-white hover:bg-black">
                      <Rocket className="h-4 w-4" /> Create a Test Paper
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={goToHistory}>
                    View History
                  </Button>
                  <Link to="/pricing">
                    <Button variant="ghost" className="gap-1">
                      <Zap className="h-4 w-4" /> Upgrade
                    </Button>
                  </Link>
                </div>
              </CardHeader>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Tests Generated" value={recentTests.length} icon={FileText} />
              <KpiCard title="Avg. Time to Paper" value="01:42" icon={TimerReset} />
              <KpiCard title="Syllabus Match" value="99%" icon={TrendingUp} />
              <KpiCard title="Streak" value={3} icon={Flame} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Tests */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent Tests</h2>
                  <Button variant="ghost" onClick={goToHistory}>
                    View All
                  </Button>
                </div>
                <div className="space-y-3">
                  {recentTests.map((test) => (
                    <Card key={test.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2 h-2 rounded-full ${
                                test.subject === "Physics" ? "bg-red-400" :
                                test.subject === "Mathematics" ? "bg-blue-400" : "bg-green-400"
                              }`} />
                              <h3 className="font-semibold">{test.name}</h3>
                              <Badge variant="secondary">{test.subject}</Badge>
                              <Badge className={
                                test.status === "Ready" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                              }>
                                {test.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{test.date} • {test.questions} questions</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">View</Button>
                            <Button variant="outline" size="sm">Edit</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Announcements */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BellDot className="h-4 w-4" />
                    <CardTitle>Announcements</CardTitle>
                  </div>
                  <CardDescription>What's new in a4ai</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {announcements.map((announcement) => (
                    <div key={announcement.id} className="border rounded-lg p-3">
                      <div className="font-medium">{announcement.title}</div>
                      <div className="text-sm text-gray-600">{announcement.desc}</div>
                      <div className="text-xs text-gray-500 mt-1">{announcement.date}</div>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full">See changelog</Button>
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Host a live contest</h3>
                    <p className="text-gray-600">Proctor with camera checks, rankings and exports.</p>
                  </div>
                  <Link to="/dashboard/contest/create">
                    <Button className="gap-2 bg-gray-900 text-white hover:bg-black">
                      <Rocket className="h-4 w-4" /> Create contest
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

// Simple KPI Card
function KpiCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">{title}</div>
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <div className="mt-2 text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}