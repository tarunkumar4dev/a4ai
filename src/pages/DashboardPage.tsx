import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
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
import { Plus, ArrowRight, FileText, Zap, BarChart2, ChevronRight } from "lucide-react";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { profile, loading } = useUserProfile();

  // Ensure profile exists after login
  useEffect(() => {
    const ensureProfileExists = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile && !fetchError) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || "User",
          role: "student",
        });

        if (insertError) {
          console.error("Error creating profile:", insertError.message);
        }
      }
    };

    ensureProfileExists();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const recentTests = [
    {
      id: 1,
      name: "Physics Midterm",
      date: "May 14, 2025",
      questions: 15,
      subject: "Physics",
    },
    {
      id: 2,
      name: "Calculus Quiz",
      date: "May 10, 2025",
      questions: 10,
      subject: "Mathematics",
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard - {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </h1>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-700">
                {profile.full_name} ({profile.email})
              </div>
              <Button onClick={handleLogout} variant="destructive" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto py-6">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
          >
            {/* Welcome */}
            <motion.div variants={item}>
              <Card className="border border-gray-100 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-xl">
                    Welcome back, {profile.full_name}!
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Generate custom tests using our AI-powered platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/dashboard/test-generator">
                    <Button className="group bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow hover:shadow-md">
                      Create New Test
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <motion.div variants={item}>
                <Card className="hover:shadow border border-gray-100">
                  <CardHeader className="flex flex-row justify-between items-center pb-2">
                    <CardTitle className="text-sm">Tests Generated</CardTitle>
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <FileText className="h-5 w-5 text-indigo-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{recentTests.length}</div>
                    <p className="text-xs text-gray-500 mt-1">This month</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="hover:shadow border border-gray-100">
                  <CardHeader className="flex flex-row justify-between items-center pb-2">
                    <CardTitle className="text-sm">Usage</CardTitle>
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <BarChart2 className="h-5 w-5 text-purple-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">7/10</div>
                    <p className="text-xs text-gray-500 mt-1">Free tests remaining</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="border-2 border-dashed border-indigo-200 hover:shadow bg-indigo-50/30">
                  <CardHeader>
                    <CardTitle className="text-sm flex gap-2 items-center">
                      <Zap className="h-4 w-4 text-amber-400" />
                      Upgrade to Premium
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-600">
                      Unlimited tests and advanced features.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to="/dashboard/subscription">
                      <Button variant="outline" className="w-full border-indigo-300 text-indigo-600">
                        View Plans
                      </Button>
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
                  <Button variant="ghost" size="sm" className="text-indigo-600">
                    View All <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                {recentTests.map((test) => (
                  <motion.div
                    key={test.id}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.1 }}
                    className="group"
                  >
                    <Card className="border border-gray-100 group-hover:border-indigo-100 transition">
                      <div className="p-4 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                test.subject === "Physics" ? "bg-red-400" : "bg-blue-400"
                              }`}
                            />
                            <h3 className="font-medium">{test.name}</h3>
                          </div>
                          <p className="text-sm text-gray-500">
                            {test.date} • {test.questions} questions • {test.subject}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
