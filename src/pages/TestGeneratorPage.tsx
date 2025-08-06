import { generateTest } from "@/lib/generateTest";
import { downloadPDF } from "@/lib/downloadPDF";
import TestGeneratorForm from "@/components/TestGeneratorForm";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TestGeneratorPage = () => {
  const handleGenerateTest = async (formData) => {
    try {
      const res = await generateTest(formData);
      if (res.test) {
        return {
          test: res.test,
          provider: res.provider,
        };
      } else {
        throw new Error("No test content returned");
      }
    } catch (err) {
      console.error("Generation Error:", err);
      throw err;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 bg-white border-b shadow-sm z-10">
          <div className="max-w-6xl mx-auto w-full px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-800">
              🧠 Test Generator
            </h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <Tabs defaultValue="test-generator" className="w-full">
              <TabsList className="grid grid-cols-3 bg-zinc-100 rounded-xl overflow-hidden mb-6 shadow-sm">
                <TabsTrigger value="test-generator">✏️ Generate Test</TabsTrigger>
                <TabsTrigger value="history">📜 History</TabsTrigger>
                <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
              </TabsList>
              <TabsContent value="test-generator">
                <section className="bg-white rounded-xl p-6 shadow-md transition-all">
                  <h2 className="text-xl font-semibold mb-4">Create New Test</h2>
                  <TestGeneratorForm onGenerate={handleGenerateTest} />
                </section>
              </TabsContent>
              <TabsContent value="history">
                <section className="bg-white rounded-xl p-6 shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Test History</h2>
                  <p className="text-zinc-500">You haven't generated any tests yet.</p>
                </section>
              </TabsContent>
              <TabsContent value="analytics">
                <section className="bg-white rounded-xl p-6 shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Test Analytics</h2>
                  <p className="text-zinc-500">Analytics will appear after generating tests.</p>
                </section>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TestGeneratorPage;
