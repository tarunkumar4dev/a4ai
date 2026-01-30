// src/pages/TeacherDashboardPage.tsx
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import ScratchCard from "@/components/ScratchCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Flame,
  FileText,
  Coins,
  Users,
  BookOpen,
  School,
  BarChart3,
  TrendingUp,
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
  Sparkles,
  Zap,
  Rocket,
  Lightbulb,
  Target as TargetIcon,
  Filter,
  Star,
  ChevronRight,
  MessageSquare,
  UserPlus,
  LineChart,
  Puzzle,
  Shield,
  Globe,
  BellRing,
  PlusCircle,
  Edit,
  Trash2,
  Download,
  Share2,
  MoreVertical,
  Search,
  Filter as FilterIcon,
  ChevronDown,
  BarChart,
  PieChart,
  Activity,
  Bookmark,
  HelpCircle,
  Settings,
  LogOut,
  User,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  EyeOff,
  Eye as EyeIcon,
  // New imports for Practice Zone
  Layers,
  Grid3x3,
  BookMarked,
  TestTube,
  Calculator,
  Atom,
  Beaker,
  FlaskConical,
  History,
  Repeat,
  TrendingUp as TrendingUpIcon,
  BarChart4,
  ActivitySquare,
  BrainCircuit,
  UserCog,
  Database,
  FileCode,
  FileCheck,
  FileX,
  FileQuestion,
  ClipboardList,
  ListChecks,
  BookCheck,
  FileSearch,
  FileBarChart,
  ChartBarIncreasing,
  ChartPie,
  ChartLine,
  ChartArea,
  ChartNoAxesColumnIncreasing,
  ChartNoAxesGantt,
  ChartCandlestick,
  ChartScatter,
  ChartBar,
  ChartColumnIncreasing,
  ChartColumn,
  ChartBarBig,
  Plus,
  Copy,
  Upload,
  FileSpreadsheet,
  Download as DownloadIcon
} from "lucide-react";

// A4AI Color Palette from images
const A4AI_COLORS = {
  primary: "#1a237e", // Dark blue from buttons
  secondary: "#283593", // Medium blue
  accent: "#5c6bc0", // Light blue
  accent2: "#3949ab", // Purple blue
  background: "#f8fafc", // Light background
  card: "#ffffff", // White cards
  surface: "#f1f5f9", // Light gray surface
  text: "#1e293b", // Dark text
  muted: "#64748b", // Gray text
  success: "#10b981", // Green
  warning: "#f59e0b", // Amber
  danger: "#ef4444", // Red
  info: "#3b82f6", // Blue
  border: "#e2e8f0", // Border color
  highlight: "#eff6ff", // Blue highlight
};

// Interface for Practice Zone Stats
interface PracticeZoneStats {
  totalQuestions: number;
  class10Questions: number;
  class12Questions: number;
  pyqCount: number;
  hotsCount: number;
  popularCount: number;
  repeatedCount: number;
  lastUpdated: string;
  subjectsCovered: number;
  chaptersCovered: number;
  totalMarks: number;
}

export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("All Classes");
  const [showStudentDetails, setShowStudentDetails] = useState<number | null>(null);
  const [practiceZoneStats, setPracticeZoneStats] = useState<PracticeZoneStats>({
    totalQuestions: 0,
    class10Questions: 0,
    class12Questions: 0,
    pyqCount: 0,
    hotsCount: 0,
    popularCount: 0,
    repeatedCount: 0,
    lastUpdated: new Date().toISOString().split('T')[0],
    subjectsCovered: 0,
    chaptersCovered: 0,
    totalMarks: 0
  });
  
  // Scratch Card State
  const [showScratchCard, setShowScratchCard] = useState(false);

  // Check if new teacher and show coins popup
  useEffect(() => {
    const checkNewTeacherAndCoins = async () => {
      const isNewUser = searchParams.get('newUser') === 'true';
      const storedHasSeenPopup = localStorage.getItem('hasSeenCoinPopup');
      
      if (profile && profile.coins && profile.coins >= 200 && !storedHasSeenPopup) {
        setTimeout(() => {
          setShowScratchCard(true);
        }, 1500);
      }
      
      if (isNewUser && !storedHasSeenPopup) {
        setTimeout(() => {
          setShowScratchCard(true);
        }, 2000);
      }
    };

    if (!loading && profile) {
      checkNewTeacherAndCoins();
    }
  }, [profile, loading, searchParams]);

  // Load practice zone stats
  useEffect(() => {
    if (profile) {
      loadPracticeZoneStats();
    }
  }, [profile]);

  const loadPracticeZoneStats = async () => {
    try {
      // Mock data - replace with actual API call
      const mockStats: PracticeZoneStats = {
        totalQuestions: 1247,
        class10Questions: 658,
        class12Questions: 589,
        pyqCount: 834,
        hotsCount: 187,
        popularCount: 156,
        repeatedCount: 70,
        lastUpdated: '2024-03-15',
        subjectsCovered: 12,
        chaptersCovered: 86,
        totalMarks: 5480
      };
      setPracticeZoneStats(mockStats);
    } catch (error) {
      console.error('Error loading practice stats:', error);
    }
  };

  // Handle scratch card close
  const handleScratchCardClose = () => {
    setShowScratchCard(false);
    localStorage.setItem('hasSeenCoinPopup', 'true');
  };

  // Navigation handlers
  const goToTestGenerator = () => navigate("/dashboard/test-generator");
  const goToTestManagement = () => navigate("/dashboard/test-generator?tab=created");
  const goToHostContest = () => navigate("/dashboard/contests");
  const goToStudentAnalytics = () => navigate("/dashboard/students/analytics");
  const goToStudentManagement = () => navigate("/dashboard/students");
  const goToClassManagement = () => navigate("/dashboard/classes");
  const goToAnalytics = () => navigate("/dashboard/analytics");
  const goToResources = () => navigate("/dashboard/resources");
  const goToSettings = () => navigate("/dashboard/settings");
  const goToPracticeZone = () => navigate("/practice/zone");
  const goToPYQAdmin = () => navigate("/admin/pyq");
  const goToBulkUpload = () => navigate("/admin/pyq?tab=bulk");
  const goToQuestionBank = () => navigate("/admin/pyq?tab=manage");

  /* ensure teacher profile */
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
          full_name: user.user_metadata?.full_name || "Teacher",
          role: "teacher",
          coins: 200,
          school: "Demo School",
          subject: "Multiple Subjects",
          experience: "5+ years"
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Get first name for personalized greeting
  const getFirstName = () => {
    if (!profile?.full_name) return "Educator";
    return profile.full_name.split(' ')[0];
  };

  // Mock data fetch (replace with actual API calls)
  const { 
    recentTests, 
    announcements, 
    teacherStats, 
    studentPerformance, 
    focusAreas, 
    aiRecommendations,
    classes,
    upcomingEvents,
    studentAttendance,
    testHistory,
    quickStats
  } = useMemo(
    () => ({
      recentTests: [
        { 
          id: 1, 
          name: "Physics Midterm", 
          date: "May 14, 2025", 
          students: 45, 
          subject: "Physics", 
          status: "Published", 
          avgScore: 78, 
          color: "#ef4444",
          duration: "90 min",
          questions: 25,
          class: "Class 10A"
        },
        { 
          id: 2, 
          name: "Calculus Quiz", 
          date: "May 10, 2025", 
          students: 32, 
          subject: "Mathematics", 
          status: "Draft", 
          avgScore: "-", 
          color: "#3b82f6",
          duration: "45 min",
          questions: 15,
          class: "Class 11B"
        },
        { 
          id: 3, 
          name: "Chemistry Practice", 
          date: "May 02, 2025", 
          students: 38, 
          subject: "Chemistry", 
          status: "Published", 
          avgScore: 82, 
          color: "#10b981",
          duration: "60 min",
          questions: 20,
          class: "Class 10B"
        },
        { 
          id: 4, 
          name: "Biology Assessment", 
          date: "Apr 28, 2025", 
          students: 42, 
          subject: "Biology", 
          status: "Graded", 
          avgScore: 85, 
          color: "#8b5cf6",
          duration: "75 min",
          questions: 30,
          class: "Class 9A"
        },
      ],
      announcements: [
        { id: "a1", title: "Staff Meeting", desc: "Monthly teaching strategies discussion.", icon: Users, date: "Tomorrow", priority: "high" },
        { id: "a2", title: "Contest Announcement", desc: "Host your own academic competition.", icon: Trophy, date: "Next Week", priority: "medium" },
        { id: "a3", title: "AI Workshop", desc: "Learn to integrate AI in classroom.", icon: Brain, date: "May 25", priority: "high" },
        { id: "a4", title: "System Update", desc: "New analytics features available.", icon: BarChart3, date: "Today", priority: "medium" },
      ],
      teacherStats: {
        activeStudents: 156,
        testsCreated: 24,
        avgEngagement: 92,
        pendingReviews: 8,
        contestsHosted: 3,
        classes: 6,
        aiAssisted: 12,
        attendanceRate: 94,
        avgScore: 81,
      },
      studentPerformance: [
        { 
          id: 1, 
          name: "Sarah Johnson", 
          avgScore: 94, 
          improvement: "+8%", 
          testsTaken: 12, 
          status: "Excellent", 
          avatarColor: "#8b5cf6",
          attendance: 98,
          class: "Class 10A",
          email: "sarah.j@example.com",
          lastActive: "2 hours ago"
        },
        { 
          id: 2, 
          name: "Michael Chen", 
          avgScore: 87, 
          improvement: "+5%", 
          testsTaken: 10, 
          status: "Good", 
          avatarColor: "#3b82f6",
          attendance: 95,
          class: "Class 11B",
          email: "michael.c@example.com",
          lastActive: "1 day ago"
        },
        { 
          id: 3, 
          name: "Emma Williams", 
          avgScore: 72, 
          improvement: "-3%", 
          testsTaken: 8, 
          status: "Needs Attention", 
          avatarColor: "#f59e0b",
          attendance: 82,
          class: "Class 10B",
          email: "emma.w@example.com",
          lastActive: "3 days ago"
        },
        { 
          id: 4, 
          name: "David Brown", 
          avgScore: 65, 
          improvement: "+12%", 
          testsTaken: 6, 
          status: "Improving", 
          avatarColor: "#10b981",
          attendance: 88,
          class: "Class 9A",
          email: "david.b@example.com",
          lastActive: "5 hours ago"
        },
      ],
      focusAreas: [
        { subject: "Physics", avgScore: 78, weakTopic: "Quantum Mechanics", studentsStruggling: 12, progress: 65, color: "#ef4444" },
        { subject: "Mathematics", avgScore: 82, weakTopic: "Calculus", studentsStruggling: 8, progress: 82, color: "#3b82f6" },
        { subject: "Chemistry", avgScore: 75, weakTopic: "Organic Chemistry", studentsStruggling: 15, progress: 50, color: "#10b981" },
        { subject: "Biology", avgScore: 85, weakTopic: "Genetics", studentsStruggling: 5, progress: 90, color: "#8b5cf6" },
      ],
      aiRecommendations: [
        { id: 1, title: "Personalized Learning Paths", desc: "Create adaptive learning plans for struggling students", icon: Puzzle, action: "Configure", route: "/dashboard/ai/paths" },
        { id: 2, title: "AI Quiz Generator", desc: "Generate quizzes based on recent topics", icon: Zap, action: "Try Now", route: "/dashboard/test-generator" },
        { id: 3, title: "Engagement Analytics", desc: "Deep insights into student participation", icon: LineChart, action: "View Report", route: "/dashboard/analytics" },
        { id: 4, title: "Remedial Content", desc: "Generate targeted practice material", icon: BookOpen, action: "Create", route: "/dashboard/resources/remedial" },
      ],
      classes: [
        { id: 1, name: "Class 10A", subject: "Physics", students: 28, avgScore: 78, color: "#ef4444" },
        { id: 2, name: "Class 11B", subject: "Mathematics", students: 32, avgScore: 82, color: "#3b82f6" },
        { id: 3, name: "Class 10B", subject: "Chemistry", students: 30, avgScore: 75, color: "#10b981" },
        { id: 4, name: "Class 9A", subject: "Biology", students: 26, avgScore: 85, color: "#8b5cf6" },
      ],
      upcomingEvents: [
        { id: 1, title: "Parent-Teacher Meeting", date: "May 20, 2025", time: "2:00 PM", type: "meeting" },
        { id: 2, title: "Science Fair", date: "May 25, 2025", time: "10:00 AM", type: "event" },
        { id: 3, title: "Final Exams", date: "Jun 15, 2025", time: "9:00 AM", type: "exam" },
      ],
      studentAttendance: {
        present: 142,
        absent: 8,
        late: 6,
        rate: 94
      },
      testHistory: [
        { month: "Jan", tests: 4, avgScore: 78 },
        { month: "Feb", tests: 6, avgScore: 82 },
        { month: "Mar", tests: 5, avgScore: 79 },
        { month: "Apr", tests: 8, avgScore: 85 },
        { month: "May", tests: 7, avgScore: 81 },
      ],
      quickStats: [
        { label: "Tests Graded", value: "156", change: "+12%", icon: FileText, color: A4AI_COLORS.primary },
        { label: "Student Queries", value: "24", change: "-3%", icon: MessageSquare, color: A4AI_COLORS.secondary },
        { label: "AI Assisted", value: "92%", change: "+5%", icon: Brain, color: A4AI_COLORS.accent2 },
        { label: "Avg. Time Saved", value: "8h/wk", change: "+15%", icon: Clock, color: A4AI_COLORS.success },
      ]
    }),
    []
  );

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    return studentPerformance.filter(student =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, studentPerformance]);

  // Test actions
  const handleTestAction = (testId: number, action: string) => {
    switch(action) {
      case 'edit':
        navigate(`/dashboard/test-generator?edit=${testId}`);
        break;
      case 'delete':
        // Implement delete logic
        console.log(`Delete test ${testId}`);
        break;
      case 'share':
        // Implement share logic
        console.log(`Share test ${testId}`);
        break;
      case 'results':
        navigate(`/dashboard/test/${testId}/results`);
        break;
    }
  };

  // Generate remedial content
  const generateRemedialContent = (subject: string) => {
    navigate(`/dashboard/resources/remedial?subject=${encodeURIComponent(subject)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: A4AI_COLORS.background }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: A4AI_COLORS.primary }}></div>
          <p className="text-lg" style={{ color: A4AI_COLORS.text }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: A4AI_COLORS.background, color: A4AI_COLORS.text }}>
      {/* Scratch Card Popup */}
      <ScratchCard 
        isOpen={showScratchCard}
        onClose={handleScratchCardClose}
        coins={200}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: A4AI_COLORS.card, borderColor: A4AI_COLORS.border }}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: A4AI_COLORS.highlight }}>
                    <GraduationCap className="h-6 w-6" style={{ color: A4AI_COLORS.primary }} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold" style={{ color: A4AI_COLORS.text }}>
                      Tarun's Dashboard — Teacher
                    </h1>
                    <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>
                      Welcome back, Professor {getFirstName()}!
                    </p>
                  </div>
                </div>
                
                {/* Mobile menu button */}
                <div className="sm:hidden">
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: A4AI_COLORS.muted }} />
                  <input
                    type="text"
                    placeholder="Search tests, students..."
                    className="pl-10 pr-4 py-2 rounded-lg border text-sm w-full sm:w-64"
                    style={{ 
                      backgroundColor: A4AI_COLORS.surface,
                      borderColor: A4AI_COLORS.border,
                      color: A4AI_COLORS.text
                    }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" style={{ color: A4AI_COLORS.muted }} />
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
                </Button>

                {/* Coins */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                  <Coins size={18} className="text-yellow-500" />
                  <span className="font-semibold">{profile?.coins || 200}</span>
                  <span className="text-sm" style={{ color: A4AI_COLORS.muted }}>Coins</span>
                </div>

                {/* Profile dropdown */}
                <div className="relative">
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: A4AI_COLORS.primary }}>
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <ChevronDown className="h-4 w-4" style={{ color: A4AI_COLORS.muted }} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 py-6">
          <div className="max-w-7xl mx-auto px-4 space-y-6">
            {/* Hero Banner */}
            <div className="rounded-xl p-6 relative overflow-hidden border" style={{ 
              backgroundColor: A4AI_COLORS.card,
              borderColor: A4AI_COLORS.border,
              background: `linear-gradient(135deg, ${A4AI_COLORS.card} 0%, ${A4AI_COLORS.highlight} 100%)`
            }}>
              <div className="absolute top-0 right-0 w-48 h-48 opacity-10">
                <Brain className="w-full h-full" style={{ color: A4AI_COLORS.primary }} />
              </div>
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-5 w-5" style={{ color: A4AI_COLORS.accent2 }} />
                      <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ backgroundColor: A4AI_COLORS.highlight, color: A4AI_COLORS.primary }}>
                        AI Assistant Active
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: A4AI_COLORS.text }}>
                      Monitor student progress and enhance learning experiences with AI-powered tools.
                    </h2>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <Button 
                        onClick={goToTestGenerator}
                        className="font-semibold shadow-md hover:shadow-lg transition-shadow"
                        style={{ 
                          backgroundColor: A4AI_COLORS.primary,
                          color: 'white',
                        }}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Create New Test
                      </Button>
                      <Button 
                        onClick={goToTestManagement}
                        variant="outline"
                        className="font-medium border-2"
                        style={{ 
                          borderColor: A4AI_COLORS.primary,
                          color: A4AI_COLORS.primary,
                          backgroundColor: 'white'
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Manage Tests
                      </Button>
                      <Button 
                        onClick={goToHostContest}
                        variant="outline"
                        className="font-medium border-2"
                        style={{ 
                          borderColor: A4AI_COLORS.accent2,
                          color: A4AI_COLORS.accent2,
                          backgroundColor: 'white'
                        }}
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        Host Contest
                      </Button>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <Rocket className="h-28 w-28" style={{ color: A4AI_COLORS.accent }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Active Students</p>
                      <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>{teacherStats.activeStudents}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-medium text-green-600">+12%</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: A4AI_COLORS.highlight }}>
                      <Users className="h-5 w-5" style={{ color: A4AI_COLORS.primary }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Tests Created</p>
                      <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>{teacherStats.testsCreated}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-medium text-green-600">+5 this month</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.success}20` }}>
                      <FileText className="h-5 w-5" style={{ color: A4AI_COLORS.success }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Avg Engagement</p>
                      <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>{teacherStats.avgEngagement}%</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-medium text-green-600">+3.2%</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.warning}20` }}>
                      <Activity className="h-5 w-5" style={{ color: A4AI_COLORS.warning }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>Attendance Rate</p>
                      <p className="text-2xl font-bold" style={{ color: A4AI_COLORS.text }}>{teacherStats.attendanceRate}%</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-medium text-green-600">+2.1%</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.info}20` }}>
                      <CheckCircle className="h-5 w-5" style={{ color: A4AI_COLORS.info }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                <TabsTrigger 
                  value="students" 
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:font-semibold rounded-none"
                  style={{ 
                    color: activeTab === 'students' ? A4AI_COLORS.primary : A4AI_COLORS.muted,
                    borderColor: A4AI_COLORS.primary 
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Students
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
                  Tests
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
                <TabsTrigger 
                  value="ai-tools" 
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:font-semibold rounded-none"
                  style={{ 
                    color: activeTab === 'ai-tools' ? A4AI_COLORS.primary : A4AI_COLORS.muted,
                    borderColor: A4AI_COLORS.primary 
                  }}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  AI Tools
                </TabsTrigger>
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
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Recent Tests & Student Performance */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Recent Tests & Assignments */}
                    <Card className="border shadow-sm">
                      <CardHeader className="border-b" style={{ borderColor: A4AI_COLORS.border }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Recent Tests & Assignments</CardTitle>
                            <CardDescription style={{ color: A4AI_COLORS.muted }}>
                              Your recently created assessments
                            </CardDescription>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={goToTestManagement}
                            style={{ color: A4AI_COLORS.primary }}
                          >
                            View All <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {recentTests.map((test) => (
                            <div 
                              key={test.id} 
                              className="flex items-center justify-between p-4 rounded-lg border hover:border-gray-300 transition-colors"
                              style={{ 
                                backgroundColor: A4AI_COLORS.card,
                                borderColor: A4AI_COLORS.border
                              }}
                            >
                              <div className="flex items-start gap-4">
                                <div 
                                  className="p-3 rounded-lg"
                                  style={{ backgroundColor: `${test.color}10` }}
                                >
                                  <FileText className="h-6 w-6" style={{ color: test.color }} />
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-1" style={{ color: A4AI_COLORS.text }}>
                                    {test.name}
                                  </h4>
                                  <div className="flex items-center gap-3 text-sm" style={{ color: A4AI_COLORS.muted }}>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {test.date}
                                    </span>
                                    <span>•</span>
                                    <span>{test.class}</span>
                                    <span>•</span>
                                    <span>{test.duration}</span>
                                    <span>•</span>
                                    <span>{test.questions} questions</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge 
                                      variant="outline"
                                      className="text-xs"
                                      style={{ 
                                        borderColor: A4AI_COLORS.border,
                                        color: A4AI_COLORS.text
                                      }}
                                    >
                                      {test.students} students
                                    </Badge>
                                    {test.avgScore !== '-' && (
                                      <Badge 
                                        className="text-xs"
                                        style={{ 
                                          backgroundColor: test.avgScore > 80 ? `${A4AI_COLORS.success}20` : 
                                                         test.avgScore > 70 ? `${A4AI_COLORS.warning}20` : 
                                                         `${A4AI_COLORS.danger}20`,
                                          color: test.avgScore > 80 ? A4AI_COLORS.success : 
                                                 test.avgScore > 70 ? A4AI_COLORS.warning : 
                                                 A4AI_COLORS.danger
                                        }}
                                      >
                                        Avg: {test.avgScore}%
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  className="font-medium"
                                  style={{ 
                                    backgroundColor: test.status === "Published" ? `${A4AI_COLORS.success}10` : 
                                                   test.status === "Draft" ? `${A4AI_COLORS.warning}10` : 
                                                   `${A4AI_COLORS.info}10`,
                                    color: test.status === "Published" ? A4AI_COLORS.success : 
                                           test.status === "Draft" ? A4AI_COLORS.warning : 
                                           A4AI_COLORS.info
                                  }}
                                >
                                  {test.status}
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleTestAction(test.id, 'results')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleTestAction(test.id, 'edit')}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Student Performance Analytics */}
                    <Card className="border shadow-sm">
                      <CardHeader className="border-b" style={{ borderColor: A4AI_COLORS.border }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Student Performance Analytics</CardTitle>
                            <CardDescription style={{ color: A4AI_COLORS.muted }}>
                              Top performing students & areas needing attention
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <select 
                              className="text-sm border rounded px-3 py-1"
                              style={{ 
                                backgroundColor: A4AI_COLORS.surface,
                                borderColor: A4AI_COLORS.border,
                                color: A4AI_COLORS.text
                              }}
                              value={selectedClass}
                              onChange={(e) => setSelectedClass(e.target.value)}
                            >
                              <option value="All Classes">All Classes</option>
                              {classes.map(cls => (
                                <option key={cls.id} value={cls.name}>{cls.name}</option>
                              ))}
                            </select>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={goToStudentAnalytics}
                              style={{ color: A4AI_COLORS.primary }}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {filteredStudents.map((student) => (
                            <div 
                              key={student.id} 
                              className="p-4 rounded-lg border hover:border-gray-300 transition-colors cursor-pointer"
                              style={{ 
                                backgroundColor: A4AI_COLORS.card,
                                borderColor: A4AI_COLORS.border,
                                borderLeft: `4px solid ${student.avatarColor}`
                              }}
                              onClick={() => setShowStudentDetails(showStudentDetails === student.id ? null : student.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div 
                                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                                    style={{ backgroundColor: student.avatarColor }}
                                  >
                                    {student.name.charAt(0)}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-1" style={{ color: A4AI_COLORS.text }}>
                                      {student.name}
                                    </h4>
                                    <div className="flex items-center gap-3 text-sm" style={{ color: A4AI_COLORS.muted }}>
                                      <span>{student.class}</span>
                                      <span>•</span>
                                      <span>Attendance: {student.attendance}%</span>
                                      <span>•</span>
                                      <span>{student.testsTaken} tests</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xl font-bold mb-1" style={{ color: A4AI_COLORS.text }}>
                                      {student.avgScore}%
                                    </p>
                                    <div className="flex items-center justify-end gap-1">
                                      <span className={`text-sm font-medium ${student.improvement.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                                        {student.improvement}
                                      </span>
                                      <TrendingUp className={`h-3 w-3 ${student.improvement.startsWith('+') ? 'text-green-600' : 'text-red-600'}`} />
                                    </div>
                                  </div>
                                  <Badge 
                                    className="font-medium"
                                    style={{ 
                                      backgroundColor: 
                                        student.status === "Excellent" ? `${A4AI_COLORS.success}10` :
                                        student.status === "Good" ? `${A4AI_COLORS.info}10` :
                                        student.status === "Improving" ? `${A4AI_COLORS.warning}10` :
                                        `${A4AI_COLORS.danger}10`,
                                      color: 
                                        student.status === "Excellent" ? A4AI_COLORS.success :
                                        student.status === "Good" ? A4AI_COLORS.info :
                                        student.status === "Improving" ? A4AI_COLORS.warning :
                                        A4AI_COLORS.danger
                                    }}
                                  >
                                    {student.status}
                                  </Badge>
                                </div>
                              </div>
                              
                              {/* Expanded Student Details */}
                              {showStudentDetails === student.id && (
                                <div className="mt-4 pt-4 border-t" style={{ borderColor: A4AI_COLORS.border }}>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-xs mb-1" style={{ color: A4AI_COLORS.muted }}>Email</p>
                                      <p className="text-sm font-medium">{student.email}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs mb-1" style={{ color: A4AI_COLORS.muted }}>Last Active</p>
                                      <p className="text-sm font-medium">{student.lastActive}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs mb-1" style={{ color: A4AI_COLORS.muted }}>Tests Taken</p>
                                      <p className="text-sm font-medium">{student.testsTaken}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs mb-1" style={{ color: A4AI_COLORS.muted }}>Attendance</p>
                                      <Progress 
                                        value={student.attendance} 
                                        className="h-2" 
                                        style={{ 
                                          backgroundColor: A4AI_COLORS.surface,
                                        }}
                                      />
                                      <p className="text-xs mt-1 font-medium">{student.attendance}%</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    <Button size="sm" variant="outline" className="text-xs">
                                      <Mail className="h-3 w-3 mr-1" />
                                      Message
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-xs">
                                      <FileText className="h-3 w-3 mr-1" />
                                      View Reports
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-xs">
                                      <BookOpen className="h-3 w-3 mr-1" />
                                      Assign Work
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column - Focus Areas & Quick Actions */}
                  <div className="space-y-6">
                    {/* Focus Areas */}
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Target className="h-5 w-5" style={{ color: A4AI_COLORS.danger }} />
                          <CardTitle>Focus Areas</CardTitle>
                        </div>
                        <CardDescription style={{ color: A4AI_COLORS.muted }}>
                          Topics needing attention
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {focusAreas.map((area, idx) => (
                          <div key={idx} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: area.color }}
                                />
                                <span className="font-medium">{area.subject}</span>
                              </div>
                              <span className={`font-bold ${area.avgScore > 80 ? 'text-green-600' : area.avgScore > 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {area.avgScore}%
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span style={{ color: A4AI_COLORS.muted }}>Weak Topic:</span>
                                <span className="font-medium">{area.weakTopic}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span style={{ color: A4AI_COLORS.muted }}>Students Struggling:</span>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                  style={{ 
                                    borderColor: A4AI_COLORS.danger,
                                    color: A4AI_COLORS.danger
                                  }}
                                >
                                  {area.studentsStruggling} students
                                </Badge>
                              </div>
                            </div>
                            <Progress 
                              value={area.progress} 
                              className="h-2" 
                              style={{ 
                                backgroundColor: A4AI_COLORS.surface,
                              }}
                            />
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full text-xs"
                              onClick={() => generateRemedialContent(area.subject)}
                              style={{ 
                                borderColor: A4AI_COLORS.primary,
                                color: A4AI_COLORS.primary
                              }}
                            >
                              <BookOpen className="h-3 w-3 mr-1" />
                              Create Remedial Content
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button 
                          onClick={goToTestGenerator}
                          className="w-full justify-start gap-3 py-3"
                          style={{ 
                            backgroundColor: A4AI_COLORS.primary,
                            color: 'white',
                          }}
                        >
                          <PlusCircle className="h-5 w-5" />
                          <div className="text-left">
                            <p className="font-semibold">Create New Test</p>
                            <p className="text-xs opacity-90">AI-powered test generator</p>
                          </div>
                        </Button>
                        
                        <Button 
                          onClick={goToStudentManagement}
                          variant="outline"
                          className="w-full justify-start gap-3 py-3 border-2"
                          style={{ 
                            borderColor: A4AI_COLORS.secondary,
                            color: A4AI_COLORS.secondary,
                            backgroundColor: 'white'
                          }}
                        >
                          <Users className="h-5 w-5" />
                          <div className="text-left">
                            <p className="font-semibold">Manage Students</p>
                            <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>View all students</p>
                          </div>
                        </Button>

                        <Button 
                          onClick={goToHostContest}
                          variant="outline"
                          className="w-full justify-start gap-3 py-3 border-2"
                          style={{ 
                            borderColor: A4AI_COLORS.accent2,
                            color: A4AI_COLORS.accent2,
                            backgroundColor: 'white'
                          }}
                        >
                          <Trophy className="h-5 w-5" />
                          <div className="text-left">
                            <p className="font-semibold">Host Contest</p>
                            <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Create competition</p>
                          </div>
                        </Button>

                        <Button 
                          onClick={goToAnalytics}
                          variant="outline"
                          className="w-full justify-start gap-3 py-3"
                          style={{ 
                            borderColor: A4AI_COLORS.border,
                            color: A4AI_COLORS.text,
                            backgroundColor: A4AI_COLORS.surface
                          }}
                        >
                          <LineChart className="h-5 w-5" />
                          <div className="text-left">
                            <p className="font-semibold">View Analytics</p>
                            <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Detailed reports</p>
                          </div>
                        </Button>
                      </CardContent>
                    </Card>

                    {/* AI Recommendations */}
                    <Card className="border shadow-sm">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Brain className="h-5 w-5" style={{ color: A4AI_COLORS.primary }} />
                          <CardTitle>AI Recommendations</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {aiRecommendations.map((rec) => (
                          <div 
                            key={rec.id} 
                            className="p-3 rounded-lg border hover:border-gray-300 transition-colors cursor-pointer"
                            style={{ 
                              backgroundColor: A4AI_COLORS.card,
                              borderColor: A4AI_COLORS.border
                            }}
                            onClick={() => navigate(rec.route)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg" style={{ backgroundColor: A4AI_COLORS.highlight }}>
                                <rec.icon className="h-4 w-4" style={{ color: A4AI_COLORS.primary }} />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold mb-1 text-sm" style={{ color: A4AI_COLORS.text }}>
                                  {rec.title}
                                </h4>
                                <p className="text-xs mb-2" style={{ color: A4AI_COLORS.muted }}>
                                  {rec.desc}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Students Tab */}
              <TabsContent value="students" className="space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>Student Management</CardTitle>
                    <CardDescription>View and manage all your students</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Filters */}
                      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: A4AI_COLORS.muted }} />
                            <input
                              type="text"
                              placeholder="Search students..."
                              className="pl-10 pr-4 py-2 rounded-lg border text-sm w-full sm:w-64"
                              style={{ 
                                backgroundColor: A4AI_COLORS.surface,
                                borderColor: A4AI_COLORS.border,
                                color: A4AI_COLORS.text
                              }}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>
                          <Button variant="outline" size="icon">
                            <FilterIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button 
                          style={{ 
                            backgroundColor: A4AI_COLORS.primary,
                            color: 'white'
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Student
                        </Button>
                      </div>

                      {/* Attendance Stats */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <p className="text-2xl font-bold text-green-600">{studentAttendance.present}</p>
                          <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>Present</p>
                        </div>
                        <div className="text-center p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <p className="text-2xl font-bold text-red-600">{studentAttendance.absent}</p>
                          <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>Absent</p>
                        </div>
                        <div className="text-center p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <p className="text-2xl font-bold text-yellow-600">{studentAttendance.late}</p>
                          <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>Late</p>
                        </div>
                        <div className="text-center p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <p className="text-2xl font-bold text-blue-600">{studentAttendance.rate}%</p>
                          <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>Attendance Rate</p>
                        </div>
                      </div>

                      {/* Students Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b" style={{ borderColor: A4AI_COLORS.border }}>
                              <th className="text-left py-3 px-4 font-medium">Student</th>
                              <th className="text-left py-3 px-4 font-medium">Class</th>
                              <th className="text-left py-3 px-4 font-medium">Avg Score</th>
                              <th className="text-left py-3 px-4 font-medium">Attendance</th>
                              <th className="text-left py-3 px-4 font-medium">Status</th>
                              <th className="text-left py-3 px-4 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((student) => (
                              <tr key={student.id} className="border-b hover:bg-gray-50" style={{ borderColor: A4AI_COLORS.border }}>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                                      style={{ backgroundColor: student.avatarColor }}
                                    >
                                      {student.name.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="font-medium">{student.name}</p>
                                      <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>{student.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant="outline">{student.class}</Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{student.avgScore}%</span>
                                    <span className={`text-xs ${student.improvement.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                                      {student.improvement}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="w-24">
                                    <Progress 
                                      value={student.attendance} 
                                      className="h-2" 
                                      style={{ 
                                        backgroundColor: A4AI_COLORS.surface,
                                      }}
                                    />
                                    <p className="text-xs mt-1">{student.attendance}%</p>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge 
                                    style={{ 
                                      backgroundColor: 
                                        student.status === "Excellent" ? `${A4AI_COLORS.success}10` :
                                        student.status === "Good" ? `${A4AI_COLORS.info}10` :
                                        student.status === "Improving" ? `${A4AI_COLORS.warning}10` :
                                        `${A4AI_COLORS.danger}10`,
                                      color: 
                                        student.status === "Excellent" ? A4AI_COLORS.success :
                                        student.status === "Good" ? A4AI_COLORS.info :
                                        student.status === "Improving" ? A4AI_COLORS.warning :
                                        A4AI_COLORS.danger
                                    }}
                                  >
                                    {student.status}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Mail className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tests Tab */}
              <TabsContent value="tests" className="space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>Test Management</CardTitle>
                    <CardDescription>Create, manage, and analyze tests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Test Statistics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {quickStats.map((stat, idx) => (
                          <div key={idx} className="p-4 rounded-lg border text-center" style={{ borderColor: A4AI_COLORS.border }}>
                            <div className="flex justify-center mb-2">
                              <div className="p-2 rounded-lg" style={{ backgroundColor: `${stat.color}10` }}>
                                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                              </div>
                            </div>
                            <p className="text-2xl font-bold mb-1">{stat.value}</p>
                            <p className="text-sm mb-1" style={{ color: A4AI_COLORS.muted }}>{stat.label}</p>
                            <p className="text-xs text-green-600">{stat.change}</p>
                          </div>
                        ))}
                      </div>

                      {/* Test History Chart */}
                      <div className="p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold">Test History</h3>
                          <select 
                            className="text-sm border rounded px-3 py-1"
                            style={{ 
                              backgroundColor: A4AI_COLORS.surface,
                              borderColor: A4AI_COLORS.border,
                              color: A4AI_COLORS.text
                            }}
                          >
                            <option>Last 6 months</option>
                            <option>This year</option>
                            <option>All time</option>
                          </select>
                        </div>
                        <div className="h-48 flex items-end gap-2">
                          {testHistory.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center">
                              <div 
                                className="w-full rounded-t"
                                style={{ 
                                  height: `${item.tests * 12}px`,
                                  backgroundColor: A4AI_COLORS.primary,
                                  opacity: 0.7
                                }}
                              />
                              <p className="text-xs mt-2" style={{ color: A4AI_COLORS.text }}>{item.month}</p>
                              <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>{item.tests} tests</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Test Actions */}
                      <div className="flex flex-wrap gap-3">
                        <Button 
                          onClick={goToTestGenerator}
                          style={{ 
                            backgroundColor: A4AI_COLORS.primary,
                            color: 'white'
                          }}
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Create New Test
                        </Button>
                        <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Export Tests
                        </Button>
                        <Button variant="outline">
                          <Share2 className="h-4 w-4 mr-2" />
                          Share Tests
                        </Button>
                        <Button variant="outline">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Bulk Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>Detailed Analytics</CardTitle>
                    <CardDescription>Comprehensive insights into student performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Performance Overview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <h3 className="font-semibold mb-4">Overall Performance</h3>
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm">Mathematics</span>
                                <span className="text-sm font-medium">82%</span>
                              </div>
                              <Progress value={82} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm">Physics</span>
                                <span className="text-sm font-medium">78%</span>
                              </div>
                              <Progress value={78} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm">Chemistry</span>
                                <span className="text-sm font-medium">75%</span>
                              </div>
                              <Progress value={75} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm">Biology</span>
                                <span className="text-sm font-medium">85%</span>
                              </div>
                              <Progress value={85} className="h-2" />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <h3 className="font-semibold mb-4">Engagement Metrics</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Test Completion</p>
                                <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Students who completed tests</p>
                              </div>
                              <Badge>94%</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Average Time Spent</p>
                                <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Per test per student</p>
                              </div>
                              <Badge>42min</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Assignment Submission</p>
                                <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>On-time submissions</p>
                              </div>
                              <Badge>88%</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">AI Assistance Usage</p>
                                <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Students using AI help</p>
                              </div>
                              <Badge>67%</Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Class-wise Performance */}
                      <div>
                        <h3 className="font-semibold mb-4">Class-wise Performance</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {classes.map((cls) => (
                            <div key={cls.id} className="p-4 rounded-lg border text-center" style={{ borderColor: A4AI_COLORS.border }}>
                              <div className="mb-3">
                                <div 
                                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                                  style={{ backgroundColor: `${cls.color}10` }}
                                >
                                  <School className="h-6 w-6" style={{ color: cls.color }} />
                                </div>
                              </div>
                              <h4 className="font-semibold mb-1">{cls.name}</h4>
                              <p className="text-sm mb-2" style={{ color: A4AI_COLORS.muted }}>{cls.subject}</p>
                              <div className="flex justify-center gap-4">
                                <div>
                                  <p className="text-lg font-bold">{cls.avgScore}%</p>
                                  <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Avg Score</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold">{cls.students}</p>
                                  <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Students</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Export Options */}
                      <div className="flex justify-end gap-3">
                        <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Export as PDF
                        </Button>
                        <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Export as Excel
                        </Button>
                        <Button 
                          style={{ 
                            backgroundColor: A4AI_COLORS.primary,
                            color: 'white'
                          }}
                        >
                          <LineChart className="h-4 w-4 mr-2" />
                          Generate Detailed Report
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Tools Tab */}
              <TabsContent value="ai-tools" className="space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle>AI-Powered Teaching Tools</CardTitle>
                    <CardDescription>Enhance your teaching with AI assistance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="p-6 rounded-lg border text-center hover:shadow-md transition-shadow cursor-pointer" style={{ borderColor: A4AI_COLORS.border }}>
                        <div className="mb-4">
                          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${A4AI_COLORS.primary}10` }}>
                            <Zap className="h-8 w-8" style={{ color: A4AI_COLORS.primary }} />
                          </div>
                        </div>
                        <h4 className="font-semibold mb-2">AI Test Generator</h4>
                        <p className="text-sm mb-4" style={{ color: A4AI_COLORS.muted }}>
                          Generate curriculum-perfect tests in minutes
                        </p>
                        <Button 
                          onClick={goToTestGenerator}
                          size="sm"
                          style={{ 
                            backgroundColor: A4AI_COLORS.primary,
                            color: 'white'
                          }}
                        >
                          Try Now
                        </Button>
                      </div>

                      <div className="p-6 rounded-lg border text-center hover:shadow-md transition-shadow cursor-pointer" style={{ borderColor: A4AI_COLORS.border }}>
                        <div className="mb-4">
                          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${A4AI_COLORS.success}10` }}>
                            <Puzzle className="h-8 w-8" style={{ color: A4AI_COLORS.success }} />
                          </div>
                        </div>
                        <h4 className="font-semibold mb-2">Learning Paths</h4>
                        <p className="text-sm mb-4" style={{ color: A4AI_COLORS.muted }}>
                          Create personalized learning journeys
                        </p>
                        <Button 
                          size="sm"
                          variant="outline"
                          style={{ 
                            borderColor: A4AI_COLORS.success,
                            color: A4AI_COLORS.success
                          }}
                        >
                          Configure
                        </Button>
                      </div>

                      <div className="p-6 rounded-lg border text-center hover:shadow-md transition-shadow cursor-pointer" style={{ borderColor: A4AI_COLORS.border }}>
                        <div className="mb-4">
                          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${A4AI_COLORS.warning}10` }}>
                            <BookOpen className="h-8 w-8" style={{ color: A4AI_COLORS.warning }} />
                          </div>
                        </div>
                        <h4 className="font-semibold mb-2">Remedial Content</h4>
                        <p className="text-sm mb-4" style={{ color: A4AI_COLORS.muted }}>
                          Generate targeted practice material
                        </p>
                        <Button 
                          size="sm"
                          variant="outline"
                          style={{ 
                            borderColor: A4AI_COLORS.warning,
                            color: A4AI_COLORS.warning
                          }}
                        >
                          Create
                        </Button>
                      </div>

                      <div className="p-6 rounded-lg border text-center hover:shadow-md transition-shadow cursor-pointer" style={{ borderColor: A4AI_COLORS.border }}>
                        <div className="mb-4">
                          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${A4AI_COLORS.info}10` }}>
                            <LineChart className="h-8 w-8" style={{ color: A4AI_COLORS.info }} />
                          </div>
                        </div>
                        <h4 className="font-semibold mb-2">Predictive Analytics</h4>
                        <p className="text-sm mb-4" style={{ color: A4AI_COLORS.muted }}>
                          Forecast student performance
                        </p>
                        <Button 
                          size="sm"
                          variant="outline"
                          style={{ 
                            borderColor: A4AI_COLORS.info,
                            color: A4AI_COLORS.info
                          }}
                        >
                          View Insights
                        </Button>
                      </div>
                    </div>

                    {/* AI Usage Stats */}
                    <div className="mt-8 p-6 rounded-lg border" style={{ borderColor: A4AI_COLORS.border, backgroundColor: A4AI_COLORS.highlight }}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">AI Assistant Usage</h4>
                          <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>
                            You've saved 42 hours this month using AI tools
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold">12</p>
                            <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>AI Tasks</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">92%</p>
                            <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Accuracy</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">8h</p>
                            <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Time Saved</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Practice Zone Tab */}
              <TabsContent value="practice" className="space-y-6">
                {/* Practice Zone Header */}
                <Card className="border shadow-sm overflow-hidden">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-10"></div>
                    <CardHeader className="relative">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-2xl flex items-center gap-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.primary}10` }}>
                              <BookMarked className="h-6 w-6" style={{ color: A4AI_COLORS.primary }} />
                            </div>
                            PYQ Practice Zone - Admin Panel
                          </CardTitle>
                          <CardDescription className="text-lg mt-2">
                            Manage Previous Year Questions, HOTS, and Practice Materials for Classes 10 & 12
                          </CardDescription>
                        </div>
                        <Button 
                          onClick={goToPYQAdmin}
                          size="lg"
                          style={{ 
                            backgroundColor: A4AI_COLORS.primary,
                            color: 'white'
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Question
                        </Button>
                      </div>
                    </CardHeader>
                  </div>
                </Card>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm mb-2" style={{ color: A4AI_COLORS.muted }}>Total Questions</p>
                          <p className="text-3xl font-bold" style={{ color: A4AI_COLORS.text }}>
                            {practiceZoneStats.totalQuestions.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" style={{ color: A4AI_COLORS.info }} />
                              <span className="text-xs">Class 10: {practiceZoneStats.class10Questions}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <School className="h-3 w-3" style={{ color: A4AI_COLORS.accent2 }} />
                              <span className="text-xs">Class 12: {practiceZoneStats.class12Questions}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.primary}10` }}>
                          <Database className="h-6 w-6" style={{ color: A4AI_COLORS.primary }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm mb-2" style={{ color: A4AI_COLORS.muted }}>Question Types</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">PYQs</span>
                              <span className="font-bold" style={{ color: A4AI_COLORS.success }}>{practiceZoneStats.pyqCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">HOTS</span>
                              <span className="font-bold" style={{ color: A4AI_COLORS.warning }}>{practiceZoneStats.hotsCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Repeated</span>
                              <span className="font-bold" style={{ color: A4AI_COLORS.danger }}>{practiceZoneStats.repeatedCount}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.success}10` }}>
                          <Layers className="h-6 w-6" style={{ color: A4AI_COLORS.success }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm mb-2" style={{ color: A4AI_COLORS.muted }}>Coverage</p>
                          <p className="text-2xl font-bold mb-1" style={{ color: A4AI_COLORS.text }}>
                            {practiceZoneStats.subjectsCovered} Subjects
                          </p>
                          <p className="text-lg font-semibold" style={{ color: A4AI_COLORS.muted }}>
                            {practiceZoneStats.chaptersCovered} Chapters
                          </p>
                          <p className="text-xs mt-2" style={{ color: A4AI_COLORS.muted }}>
                            Total Marks: {practiceZoneStats.totalMarks}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.accent2}10` }}>
                          <Target className="h-6 w-6" style={{ color: A4AI_COLORS.accent2 }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm mb-2" style={{ color: A4AI_COLORS.muted }}>Last Updated</p>
                          <p className="text-2xl font-bold mb-2" style={{ color: A4AI_COLORS.text }}>
                            {new Date(practiceZoneStats.lastUpdated).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <div className="flex items-center gap-1 text-xs" style={{ color: A4AI_COLORS.muted }}>
                            <Clock className="h-3 w-3" />
                            <span>Updated weekly</span>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${A4AI_COLORS.warning}10` }}>
                          <RefreshCw className="h-6 w-6" style={{ color: A4AI_COLORS.warning }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Main Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Question Management Card */}
                  <Card className="border shadow-sm hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" style={{ color: A4AI_COLORS.primary }} />
                        Add Questions
                      </CardTitle>
                      <CardDescription>Add individual questions or bulk upload</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button 
                        onClick={goToPYQAdmin}
                        className="w-full justify-start gap-3 py-6"
                        style={{ 
                          backgroundColor: A4AI_COLORS.primary,
                          color: 'white'
                        }}
                      >
                        <Plus className="h-5 w-5" />
                        <div className="text-left">
                          <p className="font-semibold">Add Single Question</p>
                          <p className="text-xs opacity-90">Manual entry with full options</p>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </Button>
                      
                      <Button 
                        onClick={goToBulkUpload}
                        variant="outline"
                        className="w-full justify-start gap-3 py-6 border-2"
                        style={{ 
                          borderColor: A4AI_COLORS.accent,
                          color: A4AI_COLORS.accent
                        }}
                      >
                        <Upload className="h-5 w-5" />
                        <div className="text-left">
                          <p className="font-semibold">Bulk Upload (CSV)</p>
                          <p className="text-xs" style={{ color: A4AI_COLORS.muted }}>Upload multiple questions at once</p>
                        </div>
                      </Button>

                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="py-3">
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </Button>
                        <Button variant="outline" className="py-3">
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Question Bank Card */}
                  <Card className="border shadow-sm hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" style={{ color: A4AI_COLORS.success }} />
                        Question Bank
                      </CardTitle>
                      <CardDescription>Manage existing questions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button 
                        onClick={goToQuestionBank}
                        className="w-full justify-start gap-3 py-6"
                        style={{ 
                          backgroundColor: A4AI_COLORS.success,
                          color: 'white'
                        }}
                      >
                        <FileSearch className="h-5 w-5" />
                        <div className="text-left">
                          <p className="font-semibold">Browse Question Bank</p>
                          <p className="text-xs opacity-90">View, edit, and manage all questions</p>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </Button>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: A4AI_COLORS.muted }}>Active Questions</span>
                          <span className="font-semibold">{practiceZoneStats.totalQuestions}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: A4AI_COLORS.muted }}>Pending Review</span>
                          <span className="font-semibold text-yellow-600">12</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: A4AI_COLORS.muted }}>Drafts</span>
                          <span className="font-semibold text-blue-600">8</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1">
                          <Filter className="h-4 w-4 mr-2" />
                          Filter
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Search className="h-4 w-4 mr-2" />
                          Search
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Analytics & Reports Card */}
                  <Card className="border shadow-sm hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart4 className="h-5 w-5" style={{ color: A4AI_COLORS.accent2 }} />
                        Analytics & Reports
                      </CardTitle>
                      <CardDescription>Track usage and performance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          className="py-4 flex flex-col items-center justify-center"
                          onClick={() => navigate("/admin/pyq?tab=stats")}
                        >
                          <PieChart className="h-5 w-5 mb-2" style={{ color: A4AI_COLORS.primary }} />
                          <span className="text-xs font-medium">Usage Stats</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="py-4 flex flex-col items-center justify-center"
                        >
                          <ActivitySquare className="h-5 w-5 mb-2" style={{ color: A4AI_COLORS.success }} />
                          <span className="text-xs font-medium">Performance</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="py-4 flex flex-col items-center justify-center"
                        >
                          <ChartLine className="h-5 w-5 mb-2" style={{ color: A4AI_COLORS.warning }} />
                          <span className="text-xs font-medium">Trends</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="py-4 flex flex-col items-center justify-center"
                        >
                          <ChartBar className="h-5 w-5 mb-2" style={{ color: A4AI_COLORS.danger }} />
                          <span className="text-xs font-medium">Reports</span>
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: A4AI_COLORS.muted }}>Total Attempts</span>
                          <span className="font-semibold">1,847</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: A4AI_COLORS.muted }}>Avg Score</span>
                          <span className="font-semibold text-green-600">72%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: A4AI_COLORS.muted }}>Most Popular</span>
                          <span className="font-semibold">Mathematics</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity & Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Recent Activity */}
                  <Card className="border shadow-sm lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" style={{ color: A4AI_COLORS.primary }} />
                        Recent Activity
                      </CardTitle>
                      <CardDescription>Latest questions and updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { 
                            id: 1, 
                            action: 'Added', 
                            type: 'PYQ', 
                            subject: 'Mathematics', 
                            chapter: 'Calculus', 
                            user: 'You', 
                            time: '10 mins ago',
                            color: A4AI_COLORS.primary 
                          },
                          { 
                            id: 2, 
                            action: 'Edited', 
                            type: 'HOTS', 
                            subject: 'Physics', 
                            chapter: 'Electromagnetism', 
                            user: 'Dr. Sharma', 
                            time: '2 hours ago',
                            color: A4AI_COLORS.warning 
                          },
                          { 
                            id: 3, 
                            action: 'Reviewed', 
                            type: 'Repeated', 
                            subject: 'Chemistry', 
                            chapter: 'Organic', 
                            user: 'Review Team', 
                            time: '5 hours ago',
                            color: A4AI_COLORS.danger 
                          },
                          { 
                            id: 4, 
                            action: 'Published', 
                            type: 'PYQ', 
                            subject: 'Biology', 
                            chapter: 'Genetics', 
                            user: 'You', 
                            time: '1 day ago',
                            color: A4AI_COLORS.success 
                          },
                        ].map(activity => (
                          <div 
                            key={activity.id} 
                            className="flex items-center justify-between p-4 rounded-lg border hover:border-gray-300 transition-colors"
                            style={{ 
                              backgroundColor: A4AI_COLORS.card,
                              borderColor: A4AI_COLORS.border
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div 
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${activity.color}10` }}
                              >
                                <FileText className="h-5 w-5" style={{ color: activity.color }} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold">{activity.action}</span>
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ 
                                      borderColor: activity.color,
                                      color: activity.color
                                    }}
                                  >
                                    {activity.type}
                                  </Badge>
                                </div>
                                <p className="text-sm" style={{ color: A4AI_COLORS.text }}>
                                  {activity.subject} • {activity.chapter}
                                </p>
                                <p className="text-xs mt-1" style={{ color: A4AI_COLORS.muted }}>
                                  By {activity.user} • {activity.time}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card className="border shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" style={{ color: A4AI_COLORS.warning }} />
                        Quick Actions
                      </CardTitle>
                      <CardDescription>Frequently used tools</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-3"
                        onClick={() => navigate('/admin/pyq/templates')}
                      >
                        <FileCode className="h-4 w-4" />
                        <span>Question Templates</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-3"
                        onClick={() => navigate('/admin/pyq/import')}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Import from Excel</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-3"
                        onClick={() => navigate('/admin/pyq/export')}
                      >
                        <DownloadIcon className="h-4 w-4" />
                        <span>Export to CSV</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-3"
                        onClick={() => navigate('/admin/pyq/batch')}
                      >
                        <Copy className="h-4 w-4" />
                        <span>Batch Operations</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-3"
                        onClick={() => navigate('/admin/pyq/quality')}
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Quality Check</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-3"
                        onClick={() => navigate('/admin/pyq/reports')}
                      >
                        <FileBarChart className="h-4 w-4" />
                        <span>Generate Reports</span>
                      </Button>

                      <div className="pt-4 border-t" style={{ borderColor: A4AI_COLORS.border }}>
                        <Button 
                          onClick={goToPracticeZone}
                          className="w-full"
                          style={{ 
                            backgroundColor: A4AI_COLORS.primary,
                            color: 'white'
                          }}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Test Practice Zone
                        </Button>
                        <p className="text-xs text-center mt-2" style={{ color: A4AI_COLORS.muted }}>
                          Experience the student interface
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Subject-wise Distribution */}
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ChartPie className="h-5 w-5" style={{ color: A4AI_COLORS.accent2 }} />
                      Subject-wise Distribution
                    </CardTitle>
                    <CardDescription>Questions distribution across subjects and classes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Class 10 Subjects */}
                      <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" style={{ color: A4AI_COLORS.info }} />
                          Class 10 Subjects
                        </h4>
                        <div className="space-y-4">
                          {[
                            { subject: 'Mathematics', count: 245, color: A4AI_COLORS.primary, icon: Calculator },
                            { subject: 'Science', count: 198, color: A4AI_COLORS.success, icon: Beaker },
                            { subject: 'Social Science', count: 135, color: A4AI_COLORS.warning, icon: Globe },
                            { subject: 'English', count: 80, color: A4AI_COLORS.accent, icon: BookOpen },
                          ].map(item => {
                            const Icon = item.icon;
                            return (
                              <div key={item.subject} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 rounded" style={{ backgroundColor: `${item.color}10` }}>
                                      <Icon className="h-4 w-4" style={{ color: item.color }} />
                                    </div>
                                    <span className="font-medium">{item.subject}</span>
                                  </div>
                                  <span className="font-bold">{item.count}</span>
                                </div>
                                <Progress 
                                  value={(item.count / practiceZoneStats.class10Questions) * 100} 
                                  className="h-2" 
                                  style={{ 
                                    backgroundColor: A4AI_COLORS.surface,
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Class 12 Subjects */}
                      <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <School className="h-4 w-4" style={{ color: A4AI_COLORS.accent2 }} />
                          Class 12 Subjects
                        </h4>
                        <div className="space-y-4">
                          {[
                            { subject: 'Physics', count: 156, color: A4AI_COLORS.danger, icon: Atom },
                            { subject: 'Chemistry', count: 142, color: A4AI_COLORS.warning, icon: FlaskConical },
                            { subject: 'Mathematics', count: 178, color: A4AI_COLORS.primary, icon: Calculator },
                            { subject: 'Biology', count: 113, color: A4AI_COLORS.success, icon: TestTube },
                          ].map(item => {
                            const Icon = item.icon;
                            return (
                              <div key={item.subject} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 rounded" style={{ backgroundColor: `${item.color}10` }}>
                                      <Icon className="h-4 w-4" style={{ color: item.color }} />
                                    </div>
                                    <span className="font-medium">{item.subject}</span>
                                  </div>
                                  <span className="font-bold">{item.count}</span>
                                </div>
                                <Progress 
                                  value={(item.count / practiceZoneStats.class12Questions) * 100} 
                                  className="h-2" 
                                  style={{ 
                                    backgroundColor: A4AI_COLORS.surface,
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI-Powered Question Generation */}
                <Card className="border shadow-sm overflow-hidden">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50"></div>
                    <CardHeader className="relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5" style={{ color: A4AI_COLORS.accent2 }} />
                            AI-Powered Question Generation
                          </CardTitle>
                          <CardDescription>
                            Generate high-quality questions instantly using AI
                          </CardDescription>
                        </div>
                        <Badge 
                          className="px-3 py-1"
                          style={{ 
                            backgroundColor: `${A4AI_COLORS.accent2}10`,
                            color: A4AI_COLORS.accent2
                          }}
                        >
                          Beta
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="relative space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <h4 className="font-semibold mb-2">Smart Question Generator</h4>
                          <p className="text-sm mb-3" style={{ color: A4AI_COLORS.muted }}>
                            Generate questions based on topic, difficulty, and bloom's taxonomy
                          </p>
                          <Button size="sm" variant="outline" className="w-full">
                            <Zap className="h-4 w-4 mr-2" />
                            Generate
                          </Button>
                        </div>
                        
                        <div className="p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <h4 className="font-semibold mb-2">HOTS Questions</h4>
                          <p className="text-sm mb-3" style={{ color: A4AI_COLORS.muted }}>
                            Create Higher Order Thinking Skills questions automatically
                          </p>
                          <Button size="sm" variant="outline" className="w-full">
                            <Brain className="h-4 w-4 mr-2" />
                            Create HOTS
                          </Button>
                        </div>
                        
                        <div className="p-4 rounded-lg border" style={{ borderColor: A4AI_COLORS.border }}>
                          <h4 className="font-semibold mb-2">PYQ Analysis</h4>
                          <p className="text-sm mb-3" style={{ color: A4AI_COLORS.muted }}>
                            Analyze past patterns to predict important questions
                          </p>
                          <Button size="sm" variant="outline" className="w-full">
                            <TrendingUpIcon className="h-4 w-4 mr-2" />
                            Analyze
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center gap-3 pt-4">
                        <Button 
                          variant="outline"
                          onClick={() => navigate('/admin/ai/settings')}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          AI Settings
                        </Button>
                        <Button 
                          style={{ 
                            backgroundColor: A4AI_COLORS.accent2,
                            color: 'white'
                          }}
                          onClick={() => navigate('/admin/ai/assistant')}
                        >
                          <BrainCircuit className="h-4 w-4 mr-2" />
                          Launch AI Assistant
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Support Banner */}
            <div className="rounded-lg p-6 border" style={{ 
              backgroundColor: A4AI_COLORS.card,
              borderColor: A4AI_COLORS.border,
              borderLeft: `4px solid ${A4AI_COLORS.accent}`
            }}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5" style={{ color: A4AI_COLORS.accent }} />
                  <div>
                    <h4 className="font-semibold">Need help getting started?</h4>
                    <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>
                      Check our interactive tutorial or contact support
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => window.open('https://docs.a4ai.com', '_blank')}
                    style={{ 
                      borderColor: A4AI_COLORS.primary,
                      color: A4AI_COLORS.primary
                    }}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Documentation
                  </Button>
                  <Button 
                    onClick={() => navigate('/dashboard/support')}
                    style={{ 
                      backgroundColor: A4AI_COLORS.primary,
                      color: 'white'
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact Support
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t py-4" style={{ backgroundColor: A4AI_COLORS.card, borderColor: A4AI_COLORS.border }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm" style={{ color: A4AI_COLORS.muted }}>
                  © 2025 A4AI Intelligence. All rights reserved.
                </p>
                <p className="text-xs mt-1" style={{ color: A4AI_COLORS.muted }}>
                  Version 4.2.1 • Last updated: May 15, 2025
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={goToSettings}
                  style={{ color: A4AI_COLORS.muted }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
                  style={{ color: A4AI_COLORS.muted }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}