import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import PrivateRoute from "@/components/PrivateRoute";

// Pages
import LandingPage from "./pages/LandingPage";
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
import Comingsoon from "./pages/Comingsoon";

const queryClient = new QueryClient();
const isProduction = import.meta.env.MODE === 'production';
const showLanding = import.meta.env.VITE_SHOW_LAUNCH_PAGE === 'true';

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

  if (isProduction && showLanding) return <Comingsoon />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/dashboard/test-generator" element={<PrivateRoute><TestGeneratorPage /></PrivateRoute>} />
            <Route path="/dashboard/contests" element={<PrivateRoute><ContestLandingPage /></PrivateRoute>} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/contests" element={<PrivateRoute><ContestLandingPage /></PrivateRoute>} />
            <Route path="/contests/create" element={<PrivateRoute><CreateContestPage /></PrivateRoute>} />
            <Route path="/contests/join" element={<PrivateRoute><JoinContestPage /></PrivateRoute>} />

            {/* ✅ ✅ Fixed Route with dynamic contest ID */}
            <Route path="/contests/live/:contestId" element={<PrivateRoute><ContestLivePage /></PrivateRoute>} />

            <Route path="/contests/leaderboard" element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
