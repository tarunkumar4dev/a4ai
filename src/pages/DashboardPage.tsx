
import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { FileText, BarChart2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const DashboardPage = () => {
  // Mock data for dashboard
  const recentTests = [
    { id: 1, name: "Physics Midterm", date: "May 14, 2025", questions: 15 },
    { id: 2, name: "Calculus Quiz", date: "May 10, 2025", questions: 10 },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b p-4 shadow-sm">
          <div className="max-w-6xl mx-auto w-full">
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Welcome Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <h2 className="text-xl font-bold mb-2">Welcome to Zolvio.ai!</h2>
              <p className="text-gray-600 mb-4">
                Generate custom tests quickly using our AI-powered platform. Start by creating your first test.
              </p>
              <Link to="/dashboard/test-generator">
                <Button className="bg-zolvio-purple hover:bg-zolvio-purple-hover">
                  Create New Test <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Tests Generated</h3>
                  <FileText className="h-6 w-6 text-zolvio-purple" />
                </div>
                <p className="text-3xl font-bold">{recentTests.length}</p>
                <p className="text-sm text-gray-500 mt-1">This month</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Usage</h3>
                  <BarChart2 className="h-6 w-6 text-zolvio-purple" />
                </div>
                <p className="text-3xl font-bold">7/10</p>
                <p className="text-sm text-gray-500 mt-1">Free tests remaining</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-dashed border-zolvio-purple">
                <h3 className="font-semibold mb-2">Upgrade to Premium</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Get unlimited tests, advanced analytics, and more features.
                </p>
                <Link to="/dashboard/subscription">
                  <Button className="w-full bg-zolvio-purple hover:bg-zolvio-purple-hover">
                    View Plans
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Recent Tests */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold">Recent Tests</h2>
              </div>
              
              {recentTests.length > 0 ? (
                <div className="divide-y">
                  {recentTests.map((test) => (
                    <div key={test.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <h3 className="font-medium">{test.name}</h3>
                        <p className="text-sm text-gray-500">
                          {test.date} • {test.questions} questions
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-gray-500">No tests generated yet.</p>
                </div>
              )}
              
              <div className="p-4 bg-gray-50 flex justify-between items-center">
                <p className="text-sm text-gray-500">Showing {recentTests.length} tests</p>
                <Link to="/dashboard/history">
                  <Button variant="ghost" size="sm">
                    View All Tests
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
