import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import PrivateRoute from "@/components/PrivateRoute";
import { ThemeProvider } from "@/context/ThemeContext";

// Pages (code-split)
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TestGeneratorPage = lazy(() => import("./pages/TestGeneratorPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ContestLandingPage = lazy(() => import("./pages/ContestLandingPage"));
const CreateContestPage = lazy(() => import("./pages/CreateContestPage"));
const JoinContestPage = lazy(() => import("./pages/JoinContestPage"));
const ContestLivePage = lazy(() => import("./pages/ContestLivePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));

const queryClient = new QueryClient();

const AuthCallback = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/login");
      }
    });
  }, [navigate]);

  return <div className="flex justify-center p-8">Loading...</div>;
};

const App = () => {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (!profile) {
            await supabase.from("profiles").insert({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata.full_name || "New User",
              role: "teacher",
            });
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
            <BrowserRouter>
              <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading…</div>}>
                <Routes>
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route
                    path="/dashboard"
                    element={
                      <PrivateRoute>
                        <DashboardPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/dashboard/test-generator"
                    element={
                      <PrivateRoute>
                        <TestGeneratorPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/dashboard/contests"
                    element={
                      <PrivateRoute>
                        <ContestLandingPage />
                      </PrivateRoute>
                    }
                  />
                  <Route path="/features" element={<FeaturesPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route
                    path="/contests"
                    element={
                      <PrivateRoute>
                        <ContestLandingPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/contests/create"
                    element={
                      <PrivateRoute>
                        <CreateContestPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/contests/join"
                    element={
                      <PrivateRoute>
                        <JoinContestPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/contests/live/:contestId"
                    element={
                      <PrivateRoute>
                        <ContestLivePage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/contests/leaderboard"
                    element={
                      <PrivateRoute>
                        <LeaderboardPage />
                      </PrivateRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;