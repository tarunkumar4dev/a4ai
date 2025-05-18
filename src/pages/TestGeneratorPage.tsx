
import TestGeneratorForm from "@/components/TestGeneratorForm";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TestGeneratorPage = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b p-4 shadow-sm">
          <div className="max-w-5xl mx-auto w-full">
            <h1 className="text-2xl font-bold">Test Generator</h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto py-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Tabs defaultValue="test-generator">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="test-generator">Test Generator</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="test-generator" className="p-6 bg-white rounded-lg shadow-sm">
                <h2 className="text-xl font-bold mb-6">Create New Test</h2>
                <TestGeneratorForm />
              </TabsContent>
              
              <TabsContent value="history" className="p-6 bg-white rounded-lg shadow-sm">
                <h2 className="text-xl font-bold mb-4">Test History</h2>
                <p className="text-gray-500">You haven't generated any tests yet. Use the Test Generator to create your first test.</p>
              </TabsContent>
              
              <TabsContent value="analytics" className="p-6 bg-white rounded-lg shadow-sm">
                <h2 className="text-xl font-bold mb-4">Test Analytics</h2>
                <p className="text-gray-500">Analytics will be available after you've generated and used some tests.</p>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TestGeneratorPage;
