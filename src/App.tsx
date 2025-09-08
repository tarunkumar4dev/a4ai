import { useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import PrivateRoute from "@/components/PrivateRoute";
import { ThemeProvider } from "@/context/ThemeContext";
import LandingDemo from "@/components/LandingDemo";
import FAQ from "@/components/FAQ";

/* ---------- Lazy pages (marketing) ---------- */
const LandingPage        = lazy(() => import("./pages/LandingPage"));
const FeaturesPage       = lazy(() => import("./pages/FeaturesPage"));
const PricingPage        = lazy(() => import("./pages/product/PricingPage"));
const ApiPage            = lazy(() => import("./pages/product/ApiPage"));
const AboutPage          = lazy(() => import("./pages/AboutPage"));
const ContactPage        = lazy(() => import("./pages/ContactPage"));

/* ---------- Lazy pages (auth & app) ---------- */
const LoginPage          = lazy(() => import("./pages/LoginPage"));
const SignupPage         = lazy(() => import("./pages/SignupPage"));
const DashboardPage      = lazy(() => import("./pages/DashboardPage"));
const TestGeneratorPage  = lazy(() => import("./pages/TestGeneratorPage"));
const AnalyticsPage      = lazy(() => import("./pages/AnalyticsPage"));

/* ---------- NEW: Students / Notes / Settings ---------- */
const StudentsPage       = lazy(() => import("./pages/StudentsPage"));
const NotesPage          = lazy(() => import("./pages/Notes"));
const SettingsPage       = lazy(() => import("./pages/SettingsPage"));

/* ---------- Contests ---------- */
const ContestLandingPage = lazy(() => import("./pages/ContestLandingPage"));
const CreateContestPage  = lazy(() => import("./pages/CreateContestPage"));
const JoinContestPage    = lazy(() => import("./pages/JoinContestPage"));
const ContestLivePage    = lazy(() => import("./pages/ContestLivePage"));
const LeaderboardPage    = lazy(() => import("./pages/LeaderboardPage"));

/* ---------- Resources ---------- */
const ResourcesHome      = lazy(() => import("./pages/Resources/ResourcesHome"));
const DocsPage           = lazy(() => import("./pages/Resources/Documentation"));
const HelpCenterPage     = lazy(() => import("./pages/Resources/HelpCenter"));
const BlogPage           = lazy(() => import("./pages/Resources/BlogPage"));
const CaseStudiesPage    = lazy(() => import("./pages/Resources/CaseStudiesPage"));

/* ---------- Company ---------- */
const CareersPage        = lazy(() => import("./pages/company/CareersPage"));
const PrivacyPolicyPage  = lazy(() => import("./pages/company/PrivacyPolicyPage"));

/* ---------- Legal ---------- */
const TermsPage          = lazy(() => import("./pages/legal/TermsPage"));
const CookiePolicyPage   = lazy(() => import("./pages/legal/CookiePolicyPage"));

/* ---------- Utilities ---------- */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
);

const AuthCallback = () => {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        navigate(session ? "/dashboard" : "/login", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);
  return <LoadingScreen />;
};

/* ---------- NotFound (inline, lightweight) ---------- */
const NotFound = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        The page you’re looking for doesn’t exist.
      </p>
      <a
        href="/"
        className="mt-4 inline-block rounded-lg bg-indigo-600 text-white px-4 py-2"
      >
        Go home
      </a>
    </div>
  </div>
);

/* ---------- App ---------- */
const App = () => {
  // Ensure profile row exists on sign-in (safe for Google OAuth + email)
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
              full_name: session.user.user_metadata?.full_name || "New User",
              role: "teacher",
            });
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Idle-prefetch commonly visited chunks to improve perceived speed
  useEffect(() => {
    const prefetch = () => {
      // marketing
      import("./pages/FeaturesPage");
      import("./pages/product/PricingPage");
      import("./pages/company/CareersPage");
      import("./pages/Resources/Documentation");
      // app/dash
      import("./pages/StudentsPage");
      import("./pages/Notes");
      import("./pages/SettingsPage");
    };
    (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(prefetch)
      : setTimeout(prefetch, 1200);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
            <BrowserRouter>
              <ScrollToTop />
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  {/* Auth */}
                  <Route path="/auth/callback" element={<AuthCallback />} />

                  {/* Public marketing */}
                  <Route path="/"            element={<LandingPage />} />
                  <Route path="/features"    element={<FeaturesPage />} />
                  <Route path="/pricing"     element={<PricingPage />} />
                  <Route path="/api"         element={<ApiPage />} />
                  <Route path="/about"       element={<AboutPage />} />
                  <Route path="/contact"     element={<ContactPage />} />

                  {/* Company */}
                  <Route path="/careers"     element={<CareersPage />} />
                  <Route path="/privacy"     element={<PrivacyPolicyPage />} />

                  {/* Legal */}
                  <Route path="/terms"       element={<TermsPage />} />
                  <Route path="/cookies"     element={<CookiePolicyPage />} />

                  {/* Resources */}
                  <Route path="/resources"    element={<ResourcesHome />} />
                  <Route path="/docs"         element={<DocsPage />} />
                  <Route path="/help"         element={<HelpCenterPage />} />
                  <Route path="/blog"         element={<BlogPage />} />
                  <Route path="/case-studies" element={<CaseStudiesPage />} />

                  {/* Standalone sections */}
                  <Route path="/demo"         element={<LandingDemo />} />
                  <Route path="/faq"          element={<FAQ />} />

                  {/* Auth pages */}
                  <Route path="/login"        element={<LoginPage />} />
                  <Route path="/signup"       element={<SignupPage />} />

                  {/* Protected: Dashboard & core app */}
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
                    path="/dashboard/analytics"
                    element={
                      <PrivateRoute>
                        <AnalyticsPage />
                      </PrivateRoute>
                    }
                  />

                  {/* NEW: Students / Notes / Settings (protected) */}
                  <Route
                    path="/dashboard/students"
                    element={
                      <PrivateRoute>
                        <StudentsPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/dashboard/notes"
                    element={
                      <PrivateRoute>
                        <NotesPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/dashboard/settings"
                    element={
                      <PrivateRoute>
                        <SettingsPage />
                      </PrivateRoute>
                    }
                  />

                  {/* Contests (protected) */}
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

                  {/* ---- Redirect shims so /dashboard/contests* keeps working ---- */}
                  <Route path="/dashboard/contests" element={<Navigate to="/contests" replace />} />
                  <Route path="/dashboard/contests/create" element={<Navigate to="/contests/create" replace />} />
                  <Route path="/dashboard/contests/join" element={<Navigate to="/contests/join" replace />} />
                  <Route path="/dashboard/contests/live/:contestId" element={<Navigate to="/contests/live/:contestId" replace />} />
                  <Route path="/dashboard/contests/leaderboard" element={<Navigate to="/contests/leaderboard" replace />} />

                  {/* Fallbacks */}
                  <Route path="/home" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<NotFound />} />
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
