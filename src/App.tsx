// src/App.tsx
import { useEffect, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import "./styles/globals.css";

import ChankyaInstitutePublic from "@/pages/institute/chanakya";
/* -------- Core Imports -------- */
import PracticePage from "@/practice/index";
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
import { CoinProvider } from "@/context/CoinContext";
import LandingDemo from "@/components/LandingDemo";
import FAQ from "@/components/FAQ";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { toast } from "sonner";

/* ---------- Vercel Analytics ---------- */
import { Analytics } from "@vercel/analytics/react";
import { injectSpeedInsights } from "@vercel/speed-insights";
injectSpeedInsights();

/* ---------- Lazy Marketing Pages ---------- */
const LandingPage = lazy(() => import("./pages/LandingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/product/PricingPage"));
const ApiPage = lazy(() => import("./pages/product/ApiPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

const ChemistryPracticePage = lazy(() => import("./practice/chemistry"));       //12th dec (chemistry class 10)

/* ---------- Lazy Auth & App Pages ---------- */
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TestGeneratorPage = lazy(() => import("./pages/TestGeneratorPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const PracticeSessionPage = lazy(() => import("./practice/index"));

/* ---------- Students / Notes / Settings ---------- */
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const NotesPage = lazy(() => import("./pages/Notes"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

/* ---------- Contests ---------- */
const ContestLandingPage = lazy(() => import("./pages/ContestLandingPage"));
const CreateContestPage = lazy(() => import("./pages/CreateContestPage"));
const JoinContestPage = lazy(() => import("./pages/JoinContestPage"));
const ContestLivePage = lazy(() => import("./pages/ContestLivePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const ContestPreviewPage = lazy(() => import("./pages/ContestPreview"));

/* ---------- Coins ---------- */
const CoinShop = lazy(() => import("./pages/CoinShop"));

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

/* ---------- Auth Callback & Payment ---------- */
const CallbackPage = lazy(() => import("./pages/auth/callback"));
const PaymentPage = lazy(() => import("./pages/payment/paymentPage"));

/* ---------- NEW Daily Practice Module ---------- */
const PracticeSelectionPage = lazy(() => import("./practice/index"));
const PracticeSession = lazy(() => import("./practice/session"));

/* ---------- Scroll Helper ---------- */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

const queryClient = new QueryClient();

/* ---------- Loaders ---------- */
const LoadingScreen = () => (
  <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
);

const NotFound = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        The page you're looking for doesn't exist.
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

/* ---------- Auth Gates ---------- */
function AuthGateForAuthPages({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/* ---------- Idle Logout ---------- */
function IdleLogoutManager() {
  const { session } = useAuth();
  return session ? <IdleLogoutEnabled /> : null;
}
function IdleLogoutEnabled() {
  useIdleLogout({
    timeoutMs: 15 * 60 * 1000,
    warnBeforeMs: 60 * 1000,
    onWarn: () => toast("You've been inactive. Auto sign-out in 1 minute."),
    onLogout: () => toast("Signed out due to inactivity."),
  });
  return null;
}

/* ========================================================= */

const App = () => {
  // Prefetch heavy chunks on idle
  useEffect(() => {
    const prefetch = () => {
      import("./pages/FeaturesPage");
      import("./pages/product/PricingPage");
      import("./pages/company/CareersPage");
      import("./pages/Resources/Documentation");
      import("./pages/StudentsPage");
      import("./pages/Notes");
      import("./pages/SettingsPage");
      import("./pages/CoinShop");
      import("./pages/ContestPreview");
      import("./practice/index");
      import("./practice/session");
    };
    (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(prefetch)
      : setTimeout(prefetch, 1200);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IdleLogoutManager />
        <ThemeProvider>
          <CoinProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
                <BrowserRouter>
                  <ScrollToTop />
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      {/* -------- Auth callback -------- */}
                      <Route path="/auth/callback/*" element={<CallbackPage />} />

                      {/* -------- Public marketing -------- */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/features" element={<FeaturesPage />} />
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/api" element={<ApiPage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/payment" element={<PaymentPage />} />

                      {/* -------- Company -------- */}
                      <Route path="/careers" element={<CareersPage />} />
                      <Route path="/privacy" element={<PrivacyPolicyPage />} />

                      {/* -------- Legal -------- */}
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/cookies" element={<CookiePolicyPage />} />


                      <Route
                        path="/practice/chemistry"
                        element={
                          <PrivateRoute>
                            <ChemistryPracticePage />
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Resources -------- */}
                      <Route path="/resources" element={<ResourcesHome />} />
                      <Route path="/docs" element={<DocsPage />} />
                      <Route path="/help" element={<HelpCenterPage />} />
                      <Route path="/blog" element={<BlogPage />} />
                      <Route path="/case-studies" element={<CaseStudiesPage />} />


                      {/* --------Institute----------- */}
                      <Route path="/*" element={<ChankyaInstitutePublic />} />


                      {/* -------- Standalone -------- */}
                      <Route path="/demo" element={<LandingDemo />} />
                      <Route path="/faq" element={<FAQ />} />

                      {/* -------- Auth Pages -------- */}
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

                      {/* -------- Protected Routes -------- */}
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

                      {/* 🔥 Added missing pages */}
                      <Route
                        path="/students"
                        element={
                          <PrivateRoute>
                            <StudentsPage />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/notes"
                        element={
                          <PrivateRoute>
                            <NotesPage />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <PrivateRoute>
                            <SettingsPage />
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Practice Routes -------- */}
                      {/* 🔥 FIXED: Changed PracticeSessionPage to PracticeSession */}
                      <Route
                        path="/practice/session"
                        element={
                          <PrivateRoute>
                            <PracticeSession />  {/* ✅ ये practice/session.tsx को render करेगा */}
                          </PrivateRoute>
                        }
                      />
                      <Route path="/practice" element={<PracticePage />} />

                      {/* -------- NEW Daily Practice Module -------- */}
                      <Route
                        path="/daily-practice"
                        element={
                          <PrivateRoute>
                            <PracticeSelectionPage />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/daily-practice/session"
                        element={
                          <PrivateRoute>
                            <PracticeSession />
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Contests -------- */}
                      <Route path="/contests/math-weekly" element={<JoinContestPageAurora />} />
                      <Route path="/contests/sci-lab" element={<JoinContestPageAurora />} />
                      <Route path="/contests/gk-rapid" element={<JoinContestPageAurora />} />
                      <Route path="rules" element={<Rules />} />

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
                      <Route
                        path="/contests/preview/:contestId"
                        element={
                          <PrivateRoute>
                            <ContestPreviewPage />
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Coin Shop -------- */}
                      <Route
                        path="/coinshop"
                        element={
                          <PrivateRoute>
                            <CoinShop />
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Redirect shims -------- */}
                      <Route path="/dashboard/students" element={<Navigate to="/students" replace />} />
                      <Route path="/dashboard/notes" element={<Navigate to="/notes" replace />} />
                      <Route path="/dashboard/settings" element={<Navigate to="/settings" replace />} />
                      <Route path="/dashboard/contests" element={<Navigate to="/contests" replace />} />
                      <Route path="/dashboard/coinshop" element={<Navigate to="/coinshop" replace />} />

                      {/* -------- Fallback -------- */}
                      <Route path="/home" element={<Navigate to="/" replace />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <Analytics />
                  </Suspense>
                </BrowserRouter>
              </div>
            </TooltipProvider>
          </CoinProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;