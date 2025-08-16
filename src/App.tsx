import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import PrivateRoute from "@/components/PrivateRoute";
import { ThemeProvider } from "@/context/ThemeContext";

// Pages (code-split)
const LandingPage = lazy(() => import("./pages/LandingPage"));
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import TestGeneratorPage from "./pages/TestGeneratorPage";
import FeaturesPage from "./pages/FeaturesPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import ContestLandingPage from "./pages/ContestLandingPage";
import CreateContestPage from "./pages/CreateContestPage";
import JoinContestPage from "./pages/JoinContestPage";
import ContestLivePage from "./pages/ContestLivePage";
import LeaderboardPage from "./pages/LeaderboardPage";
// ⛔️ Removed Comingsoon import

const queryClient = new QueryClient();

const App = () => {
  // ✅ Session Persistence + Profile Creation after Google OAuth
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", session);

      if (event === "SIGNED_IN" && session?.user) {
        const user = session.user;

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (!existingProfile) {
          await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata.full_name || user.user_metadata.name || "",
            role: "teacher",
          });
          console.log("🔁 Created profile after Google login/signup");
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ⛔️ Removed Comingsoon gate
  // const isProduction = import.meta.env.MODE === 'production';
  // const showLanding = import.meta.env.VITE_SHOW_LAUNCH_PAGE === 'true';
  // if (isProduction && showLanding) return <Comingsoon />;

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
