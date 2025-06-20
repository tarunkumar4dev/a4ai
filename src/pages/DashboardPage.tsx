import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { FileText, BarChart2, ArrowRight, Plus, Zap, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

const DashboardPage = () => {
  // Mock data for dashboard
  const recentTests = [
    { id: 1, name: "Physics Midterm", date: "May 14, 2025", questions: 15, subject: "Physics" },
    { id: 2, name: "Calculus Quiz", date: "May 10, 2025", questions: 10, subject: "Mathematics" },
  ];

  // Lighter animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard Overview
            </h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50">
                <Zap className="h-4 w-4 text-amber-400 mr-2" />
                <span className="text-sm">7/10 tests remaining</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto py-6">
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
          >
            {/* Welcome Section */}
            <motion.div variants={item}>
              <Card className="border border-gray-100 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-xl">Welcome back to a4ai!</CardTitle>
                  <CardDescription className="text-gray-600">
                    Generate custom tests quickly using our AI-powered platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/dashboard/test-generator">
                    <Button className="group bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow hover:shadow-md">
                      Create New Test
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <motion.div variants={item}>
                <Card className="hover:shadow transition-shadow border border-gray-100">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Tests Generated</CardTitle>
                    <div className="p-2 rounded-lg bg-indigo-50">
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
                <Card className="hover:shadow transition-shadow border border-gray-100">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Usage</CardTitle>
                    <div className="p-2 rounded-lg bg-purple-50">
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
                <Card className="border-2 border-dashed border-indigo-200 hover:shadow transition-shadow bg-indigo-50/30">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-400" />
                      <span>Upgrade to Premium</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-600">
                      Unlimited tests, advanced analytics, and more features.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to="/dashboard/subscription">
                      <Button variant="outline" className="w-full border-indigo-300 text-indigo-600 hover:bg-indigo-50">
                        View Plans
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
            
            {/* Recent Tests */}
            <motion.div variants={item} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Tests</h2>
                <Link to="/dashboard/history">
                  <Button variant="ghost" size="sm" className="text-indigo-600 hover:bg-indigo-50">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
              
              {recentTests.length > 0 ? (
                <div className="space-y-2">
                  {recentTests.map((test) => (
                    <motion.div 
                      key={test.id}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.1 }}
                      className="group"
                    >
                      <Card className="transition-all group-hover:border-indigo-100 group-hover:shadow-sm border border-gray-100">
                        <div className="p-4 flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2 h-2 rounded-full ${
                                test.subject === "Physics" ? "bg-red-400" : "bg-blue-400"
                              }`} />
                              <h3 className="font-medium">{test.name}</h3>
                            </div>
                            <p className="text-sm text-gray-500">
                              {test.date} • {test.questions} questions • {test.subject}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50">
                              View
                            </Button>
                            <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50">
                              Edit
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border border-gray-100">
                  <CardContent className="p-6 text-center">
                    <div className="text-gray-500">
                      No tests generated yet. Create your first test!
                    </div>
                    <Link to="/dashboard/test-generator">
                      <Button className="mt-4" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Test
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;