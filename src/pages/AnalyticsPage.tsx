// ==========================================
// FILE: src/pages/AnalyticsPage.tsx
// ==========================================
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, BarChart3, Users2, Clock, Target, Trophy } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

// ------------------------------
// Mock data (replace with API)
// ------------------------------
const mockDailyUsage = [
  { date: "Aug 01", logins: 42, tests: 6 },
  { date: "Aug 02", logins: 55, tests: 9 },
  { date: "Aug 03", logins: 61, tests: 14 },
  { date: "Aug 04", logins: 47, tests: 7 },
  { date: "Aug 05", logins: 78, tests: 19 },
  { date: "Aug 06", logins: 90, tests: 25 },
  { date: "Aug 07", logins: 84, tests: 21 },
];

const mockTopicBreakdown = [
  { name: "Electricity", correct: 312, total: 520 },
  { name: "Optics", correct: 271, total: 480 },
  { name: "Metals", correct: 198, total: 350 },
  { name: "Acids & Bases", correct: 325, total: 510 },
];

const mockStudentLeaderboard = [
  { id: "S01", name: "Ananya Gupta", tests: 7, avgScore: 92, streak: 6 },
  { id: "S02", name: "Ravi Sharma", tests: 6, avgScore: 88, streak: 4 },
  { id: "S03", name: "Meera Iyer", tests: 5, avgScore: 86, streak: 8 },
  { id: "S04", name: "Aditya Kumar", tests: 8, avgScore: 80, streak: 2 },
];

// Utility for %
const pct = (a:number, b:number) => (b === 0 ? 0 : Math.round((a/b)*100));

// Simple metric card
const MetricCard = ({ icon:Icon, label, value, hint }:{ icon: any; label:string; value: string | number; hint?:string }) => (
  <Card className="shadow-sm hover:shadow-md transition-all">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</CardTitle>
      <div className="rounded-xl p-2 bg-gray-100 dark:bg-gray-800"><Icon className="h-4 w-4" /></div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]; // Will be overridden by theme, but OK for pies

export default function AnalyticsPage() {
  const [roleTab, setRoleTab] = useState<"teacher" | "student">("teacher");
  const [subject, setSubject] = useState("Science");
  const [klass, setKlass] = useState("Class 10");
  const [from, setFrom] = useState("2025-08-01");
  const [to, setTo] = useState("2025-08-07");

  const totals = useMemo(() => {
    const totalLogins = mockDailyUsage.reduce((s, d) => s + d.logins, 0);
    const totalTests = mockDailyUsage.reduce((s, d) => s + d.tests, 0);
    const correct = mockTopicBreakdown.reduce((s, t) => s + t.correct, 0);
    const total = mockTopicBreakdown.reduce((s, t) => s + t.total, 0);
    return { totalLogins, totalTests, accuracy: pct(correct, total) };
  }, []);

  // Pie-friendly data for topic mastery
  const topicPie = mockTopicBreakdown.map(t => ({ name: t.name, value: pct(t.correct, t.total) }));

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-7 w-7" /> Analytics
            <Badge variant="secondary" className="ml-1">Beta</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Actionable insights for teachers & students. Filter by class, subject and time range.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1"/>Export CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-dashed">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs text-muted-foreground">Role View</label>
            <Tabs value={roleTab} onValueChange={(v)=>setRoleTab(v as any)} className="mt-2">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="teacher">Teacher</TabsTrigger>
                <TabsTrigger value="student">Student</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={klass} onValueChange={setKlass}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Class 9">Class 9</SelectItem>
                <SelectItem value="Class 10">Class 10</SelectItem>
                <SelectItem value="Class 11">Class 11</SelectItem>
                <SelectItem value="Class 12">Class 12</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Subject</label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Science">Science</SelectItem>
                <SelectItem value="Maths">Maths</SelectItem>
                <SelectItem value="English">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="mt-2"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="mt-2"/>
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard icon={Users2} label="Total Logins" value={totals.totalLogins} hint="Past 7 days" />
        <MetricCard icon={Trophy} label="Tests Attempted" value={totals.totalTests} hint="Across selected class" />
        <MetricCard icon={Target} label="Average Accuracy" value={`${totals.accuracy}%`} hint="Correct / total" />
        <MetricCard icon={Clock} label="Avg Time/Test" value={`14m`} hint="Median duration" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily Activity: Logins vs Tests</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockDailyUsage} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tickMargin={8} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="logins" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="tests" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topic Mastery (Correct %)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={topicPie} dataKey="value" nameKey="name" outerRadius={90}>
                  {topicPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v:any)=>`${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Teacher vs Student Views */}
      <Tabs value={roleTab} onValueChange={(v)=>setRoleTab(v as any)}>
        <TabsContent value="teacher" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class-wise Performance</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "X-A", avg: 78, tests: 120 },
                  { name: "X-B", avg: 81, tests: 140 },
                  { name: "X-C", avg: 74, tests: 96 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Top Students (by Avg. Score)</CardTitle>
              <Badge variant="secondary">Live</Badge>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Student</th>
                    <th className="py-2 font-medium">Tests</th>
                    <th className="py-2 font-medium">Avg Score</th>
                    <th className="py-2 font-medium">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {mockStudentLeaderboard.map((s, i) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2 flex items-center gap-2"><span className="text-xs w-5 h-5 grid place-items-center rounded-full bg-primary/10 text-primary">{i+1}</span>{s.name}</td>
                      <td className="py-2">{s.tests}</td>
                      <td className="py-2 font-semibold">{s.avgScore}%</td>
                      <td className="py-2">🔥 {s.streak} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="student" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard icon={Trophy} label="Your Best Score" value={`96%`} />
            <MetricCard icon={Target} label="Weakest Topic" value={`Optics`} hint="Suggested practice ready"/>
            <MetricCard icon={Clock} label="Avg Time/Test" value={`11m`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Recent Tests</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Subject</th>
                    <th className="py-2 font-medium">Score</th>
                    <th className="py-2 font-medium">Time</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { date: "Aug 06", subject: "Science", score: 92, time: "12m" },
                    { date: "Aug 05", subject: "Maths", score: 84, time: "18m" },
                    { date: "Aug 03", subject: "Science", score: 77, time: "16m" },
                  ].map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2">{r.date}</td>
                      <td className="py-2">{r.subject}</td>
                      <td className="py-2 font-semibold">{r.score}%</td>
                      <td className="py-2">{r.time}</td>
                      <td className="py-2"><Button variant="outline" size="sm">Review</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


