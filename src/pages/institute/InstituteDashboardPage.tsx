// src/pages/institute/InstituteDashboard.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Users,
  BookOpen,
  BarChart3,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Plus,
  UserPlus,
  GraduationCap,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  Search,
  Settings,
  Bell,
  Menu,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Share2,
  Link as LinkIcon,
  Copy,
  Check,
  UserCheck,
  UserX,
  Upload,
  FileText,
  PieChart,
  LineChart,
  Users as UsersIcon,
  School,
  Target,
  AlertCircle,
  Star,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

// Color Palette
const INSTITUTE_COLORS = {
  primary: "#4f46e5",
  secondary: "#6366f1",
  accent: "#818cf8",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  background: "#f9fafb",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
};

// Types
interface Institute {
  id: string;
  name: string;
  city: string;
  subjects: string[];
  created_at: string;
  admin_id: string;
}

interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  subjects: string[];
  status: "pending" | "active" | "inactive";
  joined_at: string;
  avatar_url?: string;
}chrome


interface Batch {
  id: string;
  name: string;
  class: string;
  subjects: string[];
  teacher_id: string;
  teacher_name: string;
  student_count: number;
  created_at: string;
  status: "active" | "archived";
}

interface Test {
  id: string;
  title: string;
  batch_id: string;
  batch_name: string;
  teacher_id: string;
  teacher_name: string;
  total_questions: number;
  average_score: number;
  students_taken: number;
  total_students: number;
  created_at: string;
  status: "draft" | "published" | "completed";
}

interface Attendance {
  id: string;
  student_id: string;
  student_name: string;
  batch_id: string;
  date: string;
  status: "present" | "absent";
  marked_by: string;
}

interface Note {
  id: string;
  title: string;
  batch_id: string;
  batch_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

// Mock Data
const mockTeachers: Teacher[] = [
  { id: "1", user_id: "1", full_name: "Dr. Sarah Johnson", email: "sarah@institute.com", phone: "+1234567890", subjects: ["Physics", "Mathematics"], status: "active", joined_at: "2024-01-15" },
  { id: "2", user_id: "2", full_name: "Prof. Michael Chen", email: "michael@institute.com", phone: "+1234567891", subjects: ["Chemistry", "Biology"], status: "active", joined_at: "2024-02-01" },
  { id: "3", user_id: "3", full_name: "Ms. Emily Davis", email: "emily@institute.com", phone: "+1234567892", subjects: ["English", "History"], status: "pending", joined_at: "2024-03-10" },
];

const mockBatches: Batch[] = [
  { id: "1", name: "Class 9A", class: "9", subjects: ["Mathematics", "Science", "English"], teacher_id: "1", teacher_name: "Dr. Sarah Johnson", student_count: 35, created_at: "2024-01-20", status: "active" },
  { id: "2", name: "Class 10B", class: "10", subjects: ["Mathematics", "Science", "Social Studies"], teacher_id: "2", teacher_name: "Prof. Michael Chen", student_count: 42, created_at: "2024-01-20", status: "active" },
  { id: "3", name: "JEE Advanced Batch", class: "12", subjects: ["Physics", "Chemistry", "Mathematics"], teacher_id: "1", teacher_name: "Dr. Sarah Johnson", student_count: 28, created_at: "2024-02-15", status: "active" },
  { id: "4", name: "NEET Prep Batch", class: "12", subjects: ["Physics", "Chemistry", "Biology"], teacher_id: "2", teacher_name: "Prof. Michael Chen", student_count: 31, created_at: "2024-02-15", status: "active" },
];

const mockTests: Test[] = [
  { id: "1", title: "Physics Midterm Exam", batch_id: "1", batch_name: "Class 9A", teacher_id: "1", teacher_name: "Dr. Sarah Johnson", total_questions: 50, average_score: 78, students_taken: 32, total_students: 35, created_at: "2024-03-01", status: "completed" },
  { id: "2", title: "Chemistry Weekly Test", batch_id: "2", batch_name: "Class 10B", teacher_id: "2", teacher_name: "Prof. Michael Chen", total_questions: 30, average_score: 82, students_taken: 40, total_students: 42, created_at: "2024-03-05", status: "completed" },
  { id: "3", title: "JEE Practice Test", batch_id: "3", batch_name: "JEE Advanced Batch", teacher_id: "1", teacher_name: "Dr. Sarah Johnson", total_questions: 90, average_score: 71, students_taken: 26, total_students: 28, created_at: "2024-03-08", status: "published" },
];

const mockAttendance: Attendance[] = [
  { id: "1", student_id: "s1", student_name: "Alice Brown", batch_id: "1", date: "2024-03-15", status: "present", marked_by: "Dr. Sarah Johnson" },
  { id: "2", student_id: "s2", student_name: "Bob Wilson", batch_id: "1", date: "2024-03-15", status: "present", marked_by: "Dr. Sarah Johnson" },
  { id: "3", student_id: "s3", student_name: "Charlie Davis", batch_id: "1", date: "2024-03-15", status: "absent", marked_by: "Dr. Sarah Johnson" },
];

const mockNotes: Note[] = [
  { id: "1", title: "Physics Chapter 1 - Motion", batch_id: "1", batch_name: "Class 9A", file_url: "#", file_type: "pdf", uploaded_by: "Dr. Sarah Johnson", uploaded_at: "2024-03-10" },
  { id: "2", title: "Chemistry Periodic Table", batch_id: "2", batch_name: "Class 10B", file_url: "#", file_type: "pdf", uploaded_by: "Prof. Michael Chen", uploaded_at: "2024-03-12" },
];

const InstituteDashboard = () => {
  const navigate = useNavigate();
  const { profile, loading } = useUserProfile();
  const [activeTab, setActiveTab] = useState("overview");
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>(mockTeachers);
  const [batches, setBatches] = useState<Batch[]>(mockBatches);
  const [tests, setTests] = useState<Test[]>(mockTests);
  const [attendance, setAttendance] = useState<Attendance[]>(mockAttendance);
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubject, setInviteSubject] = useState("");
  const [newBatch, setNewBatch] = useState({ name: "", class: "", subjects: "", teacher_id: "" });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState("");

  // Stats calculations
  const stats = useMemo(() => ({
    totalTeachers: teachers.filter(t => t.status === "active").length,
    pendingTeachers: teachers.filter(t => t.status === "pending").length,
    totalBatches: batches.length,
    totalStudents: batches.reduce((sum, b) => sum + b.student_count, 0),
    totalTests: tests.length,
    avgScore: tests.reduce((sum, t) => sum + t.average_score, 0) / tests.length || 0,
    attendanceRate: (attendance.filter(a => a.status === "present").length / attendance.length) * 100 || 0,
  }), [teachers, batches, tests, attendance]);

  const handleInviteTeacher = () => {
    // Send invite logic here
    console.log("Invite sent to:", inviteEmail);
    setIsInviteDialogOpen(false);
    setInviteEmail("");
    setInviteSubject("");
  };

  const handleCreateBatch = () => {
    // Create batch logic here
    console.log("New batch:", newBatch);
    setIsBatchDialogOpen(false);
    setNewBatch({ name: "", class: "", subjects: "", teacher_id: "" });
  };

  const handleUploadNote = () => {
    // Upload note logic here
    console.log("Upload note");
    setIsNoteDialogOpen(false);
  };

  const handleMarkAttendance = (studentId: string, status: "present" | "absent") => {
    setAttendance(prev => [...prev, {
      id: Date.now().toString(),
      student_id: studentId,
      student_name: "Student Name", // Would get from actual data
      batch_id: "1",
      date: selectedDate,
      status,
      marked_by: profile?.full_name || "Admin"
    }]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "inactive": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTestStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "published": return "bg-blue-100 text-blue-800";
      case "draft": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading institute dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-2 rounded-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Institute Dashboard</h1>
                <p className="text-sm text-gray-500">Manage teachers, batches, and track performance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate("/institute/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Teachers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTeachers}</p>
                  {stats.pendingTeachers > 0 && (
                    <p className="text-xs text-yellow-600 mt-1">{stats.pendingTeachers} pending approval</p>
                  )}
                </div>
                <div className="p-3 bg-indigo-100 rounded-full">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                  <p className="text-xs text-gray-500 mt-1">Across {stats.totalBatches} batches</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <GraduationCap className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Average Test Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.avgScore.toFixed(1)}%</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600">+5% this month</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Attendance Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate.toFixed(1)}%</p>
                  <div className="w-full mt-2">
                    <Progress value={stats.attendanceRate} className="h-2" />
                  </div>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-gray-200 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
            <TabsTrigger value="batches">Batches</TabsTrigger>
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Tests */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Tests</CardTitle>
                  <CardDescription>Latest test results across batches</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {tests.slice(0, 3).map((test) => (
                      <div key={test.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{test.title}</p>
                          <p className="text-sm text-gray-500">{test.batch_name} • {test.teacher_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{test.average_score}%</p>
                          <p className="text-xs text-gray-500">{test.students_taken}/{test.total_students} taken</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Teacher Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Teacher Performance</CardTitle>
                  <CardDescription>Activity and test scores by teacher</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {teachers.filter(t => t.status === "active").map((teacher) => {
                      const teacherTests = tests.filter(t => t.teacher_id === teacher.id);
                      const avgScore = teacherTests.reduce((sum, t) => sum + t.average_score, 0) / teacherTests.length || 0;
                      return (
                        <div key={teacher.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{teacher.full_name}</p>
                            <p className="text-sm text-gray-500">{teacher.subjects.join(", ")}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{avgScore.toFixed(1)}%</p>
                            <p className="text-xs text-gray-500">{teacherTests.length} tests</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Weakest Students */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Weakest Students</CardTitle>
                  <CardDescription>Students needing additional support</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Alice Brown</p>
                        <p className="text-sm text-gray-500">Class 9A • Avg Score: 45%</p>
                      </div>
                      <Button variant="ghost" size="sm">View Details</Button>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Bob Wilson</p>
                        <p className="text-sm text-gray-500">Class 10B • Avg Score: 52%</p>
                      </div>
                      <Button variant="ghost" size="sm">View Details</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                  <CardDescription>Common institute management tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite New Teacher
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Teacher</DialogTitle>
                        <DialogDescription>Send an invitation email to a teacher to join your institute</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Email Address</Label>
                          <Input
                            placeholder="teacher@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Subject (Optional)</Label>
                          <Input
                            placeholder="Join our institute as a teacher"
                            value={inviteSubject}
                            onChange={(e) => setInviteSubject(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleInviteTeacher} className="w-full">Send Invitation</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Batch
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Batch</DialogTitle>
                        <DialogDescription>Add a new batch/class to your institute</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Batch Name</Label>
                          <Input
                            placeholder="Class 9A, JEE Batch, etc."
                            value={newBatch.name}
                            onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Class/Grade</Label>
                          <Select value={newBatch.class} onValueChange={(v) => setNewBatch({ ...newBatch, class: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9">Class 9</SelectItem>
                              <SelectItem value="10">Class 10</SelectItem>
                              <SelectItem value="11">Class 11</SelectItem>
                              <SelectItem value="12">Class 12</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Subjects (comma separated)</Label>
                          <Input
                            placeholder="Mathematics, Science, English"
                            value={newBatch.subjects}
                            onChange={(e) => setNewBatch({ ...newBatch, subjects: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Assign Teacher</Label>
                          <Select value={newBatch.teacher_id} onValueChange={(v) => setNewBatch({ ...newBatch, teacher_id: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.filter(t => t.status === "active").map(teacher => (
                                <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleCreateBatch} className="w-full">Create Batch</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Notes
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Notes</DialogTitle>
                        <DialogDescription>Share study materials with a batch</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Select Batch</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose batch" />
                            </SelectTrigger>
                            <SelectContent>
                              {batches.map(batch => (
                                <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>File</Label>
                          <Input type="file" accept=".pdf,.jpg,.png,.docx" />
                        </div>
                        <Button onClick={handleUploadNote} className="w-full">Upload</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Teachers Tab */}
          <TabsContent value="teachers" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search teachers..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  {/* Dialog content same as above */}
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Subjects</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.filter(t => t.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{teacher.full_name}</p>
                            <p className="text-sm text-gray-500">{teacher.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{teacher.subjects.join(", ")}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(teacher.status)}>
                            {teacher.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(teacher.joined_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batches Tab */}
          <TabsContent value="batches" className="space-y-6">
            <div className="flex justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search batches..." className="pl-10" />
              </div>
              <Button onClick={() => setIsBatchDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Batch
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {batches.map((batch) => (
                <Card key={batch.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{batch.name}</CardTitle>
                      <Badge variant="outline">Class {batch.class}</Badge>
                    </div>
                    <CardDescription>Teacher: {batch.teacher_name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Subjects</p>
                        <div className="flex flex-wrap gap-1">
                          {batch.subjects.map((subject) => (
                            <Badge key={subject} variant="secondary" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <div>
                          <p className="text-2xl font-bold">{batch.student_count}</p>
                          <p className="text-xs text-gray-500">Students</p>
                        </div>
                        <Button variant="outline" size="sm">Manage</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="tests" className="space-y-6">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Title</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Avg Score</TableHead>
                      <TableHead>Participation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tests.map((test) => (
                      <TableRow key={test.id}>
                        <TableCell className="font-medium">{test.title}</TableCell>
                        <TableCell>{test.batch_name}</TableCell>
                        <TableCell>{test.teacher_name}</TableCell>
                        <TableCell>
                          <span className="font-bold">{test.average_score}%</span>
                        </TableCell>
                        <TableCell>
                          {test.students_taken}/{test.total_students}
                        </TableCell>
                        <TableCell>
                          <Badge className={getTestStatusColor(test.status)}>
                            {test.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            <div className="flex gap-4 items-center">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Marked By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.filter(a => a.date === selectedDate).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.student_name}</TableCell>
                        <TableCell>{batches.find(b => b.id === record.batch_id)?.name}</TableCell>
                        <TableCell>
                          <Badge className={record.status === "present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.marked_by}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-6">
            <div className="flex justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search notes..." className="pl-10" />
              </div>
              <Button onClick={() => setIsNoteDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Notes
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notes.map((note) => (
                <Card key={note.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <FileText className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{note.title}</CardTitle>
                        <CardDescription>{note.batch_name}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">Uploaded by: {note.uploaded_by}</p>
                      <p className="text-xs text-gray-400">{new Date(note.uploaded_at).toLocaleDateString()}</p>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default InstituteDashboard;