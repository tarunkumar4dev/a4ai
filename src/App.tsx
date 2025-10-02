// src/App.tsx
import { useEffect, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import "./styles/globals.css";
import PracticePage from "@/pages/PracticePage";
import JoinContestPageAurora from "@/pages/JoinContestPageAurora";
import Rules from "@/pages/Rules";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PrivateRoute from "@/components/PrivateRoute";
import { ThemeProvider } from "@/context/ThemeContext";
import LandingDemo from "@/components/LandingDemo";
import FAQ from "@/components/FAQ";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { useIdleLogout } from "@/hooks/useIdleLogout"; // ⬅️ IDLE LOGOUT
import { toast } from "sonner";                        // ⬅️ TOASTS

/* ---------- Vercel Analytics & Speed Insights ---------- */
import { Analytics } from "@vercel/analytics/react";
import { injectSpeedInsights } from "@vercel/speed-insights";
injectSpeedInsights();

/* ---------- Lazy pages (marketing) ---------- */
const LandingPage = lazy(() => import("./pages/LandingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/product/PricingPage"));
const ApiPage = lazy(() => import("./pages/product/ApiPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

/* ---------- Lazy pages (auth & app) ---------- */
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TestGeneratorPage = lazy(() => import("./pages/TestGeneratorPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

/* -------- Practice Session ---------------- */
const PracticeSessionPage = lazy(() => import("./pages/PracticeSessionPage"));


/* ---------- NEW: Students / Notes / Settings ---------- */
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const NotesPage = lazy(() => import("./pages/Notes"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

/* ---------- Contests ---------- */
const ContestLandingPage = lazy(() => import("./pages/ContestLandingPage"));
const CreateContestPage = lazy(() => import("./pages/CreateContestPage"));
const JoinContestPage = lazy(() => import("./pages/JoinContestPage"));
const ContestLivePage = lazy(() => import("./pages/ContestLivePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));

/* ---------- Resources ---------- */
const ResourcesHome = lazy(() => import("./pages/Resources/ResourcesHome"));
const DocsPage = lazy(() => import("./pages/Resources/Documentation"));
const HelpCenterPage = lazy(() => import("./pages/Resources/HelpCenter"));
const BlogPage = lazy(() => import("./pages/Resources/BlogPage"));
const CaseStudiesPage = lazy(() => import("./pages/Resources/CaseStudiesPage"));

/* ---------- Company ---------- */
const CareersPage = lazy(() => import("./pages/company/CareersPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/company/PrivacyPolicyPage"));

/* ---------- Legal ---------- */
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));
const CookiePolicyPage = lazy(() => import("./pages/legal/CookiePolicyPage"));

/* ---------- Auth callback ---------- */
const CallbackPage = lazy(() => import("./pages/auth/callback"));

/* ---------- Payment ---------- */
const PaymentPage = lazy(() => import("./pages/payment/paymentPage"));

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

/** If user is already logged in, prevent showing /login or /signup.
 *  If loading, show a spinner so we don't flash wrong page.
 */
function AuthGateForAuthPages({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Mounts the idle-logout hook only when a session exists (avoids warnings for guests). */
function IdleLogoutManager() {
  const { session } = useAuth();
  // Render the hook in a separate component to respect Rules of Hooks
  return session ? <IdleLogoutEnabled /> : null;
}
function IdleLogoutEnabled() {
  useIdleLogout({
    timeoutMs: 15 * 60 * 1000, // 15 minutes (tweak to 10–15 as you like)
    warnBeforeMs: 60 * 1000,
    onWarn: () => toast("You've been inactive. Auto sign-out in 1 minute."),
    onLogout: () => toast("Signed out due to inactivity."),
  });
  return null;
}

const App = () => {
  // NOTE: Removed any onAuthStateChange + profiles upsert from here.
  // We'll handle profile row via DB trigger (Step 5).

  // Idle-prefetch commonly visited chunks
  useEffect(() => {
    const prefetch = () => {
      import("./pages/FeaturesPage");
      import("./pages/product/PricingPage");
      import("./pages/company/CareersPage");
      import("./pages/Resources/Documentation");
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
      <AuthProvider>
        {/* Only active while logged in */}
        <IdleLogoutManager />

        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
              <BrowserRouter>
                <ScrollToTop />
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    {/* Auth callback */}
                    <Route path="/auth/callback" element={<CallbackPage />} />
                    <Route path="/auth/callback/*" element={<CallbackPage />} />

                    {/* Public marketing */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/features" element={<FeaturesPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/api" element={<ApiPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/payment" element={<PaymentPage />} />

                    {/* Company */}
                    <Route path="/careers" element={<CareersPage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />

                    {/* Legal */}
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/cookies" element={<CookiePolicyPage />} />

                    {/* Resources */}
                    <Route path="/resources" element={<ResourcesHome />} />
                    <Route path="/docs" element={<DocsPage />} />
                    <Route path="/help" element={<HelpCenterPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/case-studies" element={<CaseStudiesPage />} />

                    {/* Standalone sections */}
                    <Route path="/demo" element={<LandingDemo />} />
                    <Route path="/faq" element={<FAQ />} />

                    {/* Auth pages (redirect if already logged in) */}
                    <Route
                      path="/login"
                      element={
                        <AuthGateForAuthPages>
                          <LoginPage />
                        </AuthGateForAuthPages>
                      }
                    />
                    <Route
                      path="/signup"
                      element={
                        <AuthGateForAuthPages>
                          <SignupPage />
                        </AuthGateForAuthPages>
                      }
                    />

                    {/* Protected */}
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

                    <Route
                      path="/practice/session"
                      element={
                        <PrivateRoute>
                          <PracticeSessionPage />
                        </PrivateRoute>
                      }
                    />

                    <Route path="/practice" element={<PracticePage />} />

                    <Route path="/contests/math-weekly" element={<JoinContestPageAurora />} />
                    <Route path="/contests/sci-lab" element={<JoinContestPageAurora />} />
                    <Route path="/contests/gk-rapid" element={<JoinContestPageAurora />} />
                    <Route path="rules" element={<Rules />} />


                    {/* Students / Notes / Settings */}
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

                    {/* Contests */}
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

                    {/* Redirect shims */}
                    <Route
                      path="/dashboard/contests"
                      element={<Navigate to="/contests" replace />}
                    />
                    <Route
                      path="/dashboard/contests/create"
                      element={<Navigate to="/contests/create" replace />}
                    />
                    <Route
                      path="/dashboard/contests/join"
                      element={<Navigate to="/contests/join" replace />}
                    />
                    <Route
                      path="/dashboard/contests/live/:contestId"
                      element={<Navigate to="/contests/live/:contestId" replace />}
                    />
                    <Route
                      path="/dashboard/contests/leaderboard"
                      element={<Navigate to="/contests/leaderboard" replace />}
                    />

                    {/* Fallbacks */}
                    <Route path="/home" element={<Navigate to="/" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>

                  {/* Vercel Web Analytics - tracks SPA route changes */}
                  <Analytics />
                </Suspense>
              </BrowserRouter>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
