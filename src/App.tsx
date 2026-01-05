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
import { SpeedInsights } from "@vercel/speed-insights/react";

/* ---------- Lazy Loading Configuration ---------- */
const LAZY_LOADING_DELAY = 1000; // 1 second delay for better UX

/* ---------- Lazy Marketing Pages ---------- */
const LandingPage = lazy(() => 
  Promise.all([
    import("./pages/LandingPage"),
    new Promise(resolve => setTimeout(resolve, LAZY_LOADING_DELAY))
  ]).then(([module]) => module)
);

const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/product/PricingPage"));
const ApiPage = lazy(() => import("./pages/product/ApiPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

const ChemistryPracticePage = lazy(() => import("./practice/chemistry"));

/* ---------- Lazy Auth & App Pages ---------- */
const RoleSelectionPage = lazy(() => import("./pages/RoleSelectionPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const StudentDashboardPage = lazy(() => import("./pages/StudentDashboardPage"));
const TeacherDashboardPage = lazy(() => import("./pages/TeacherDashboardPage"));
const TestGeneratorPage = lazy(() => import("./pages/TestGeneratorPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

/* ---------- Students / Notes / Settings ---------- */
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const NotesPage = lazy(() => import("./pages/Notes"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

/* ---------- FLASHCARDS ---------- */
const FlashcardDashboard = lazy(() => import("./pages/flashcards/FlashcardDashboard"));
const FlashcardChapter = lazy(() => import("./pages/flashcards/FlashcardChapter"));
const FlashcardSubject = lazy(() => import("./pages/flashcards/FlashcardSubject"));

/* ---------- Contests ---------- */
const ContestLandingPage = lazy(() => import("./pages/ContestLandingPage"));
const CreateContestPage = lazy(() => import("./pages/CreateContestPage"));
const JoinContestPage = lazy(() => import("./pages/JoinContestPage"));
const ContestLivePage = lazy(() => import("./pages/ContestLivePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const ContestPreviewPage = lazy(() => import("./pages/ContestPreview"));

/* ---------- Mega Contest Pages ---------- */
// IMPORTANT: Added error boundary to prevent crash if file doesn't exist
const MegaContestLivePage = lazy(() => 
  import("./pages/MegaContestLivePage")
    .then(module => ({ default: module.default }))
    .catch(error => {
      console.error("Failed to load MegaContestLivePage:", error);
      // Return a fallback component
      return {
        default: () => (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Component Loading Error</h2>
              <p className="text-gray-600 mb-6">
                The contest page could not be loaded. This might be a temporary issue.
              </p>
              <button
                onClick={() => window.location.href = "/contests"}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Contests
              </button>
            </div>
          </div>
        )
      };
    })
);

const AdminAddQuestions = lazy(() => import("./pages/AdminAddQuestions"));

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

/* ---------- Daily Practice Module ---------- */
const PracticeSelectionPage = lazy(() => import("./practice/index"));
const PracticeSession = lazy(() => import("./practice/session"));

/* ---------- Scroll Helper ---------- */
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    // Smooth scroll to top
    window.scrollTo({ 
      top: 0, 
      behavior: pathname === "/" ? "auto" : "smooth" 
    });
  }, [pathname]);
  
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/* ---------- Loaders ---------- */
const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
    <div className="relative">
      <div className="w-16 h-16 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <div className="absolute inset-0 w-16 h-16 border-3 border-purple-500/30 border-b-transparent rounded-full animate-spin-reverse"></div>
    </div>
    <h2 className="text-lg font-semibold text-slate-900 mt-4">Loading...</h2>
    <p className="text-slate-500 text-sm mt-1">Please wait a moment</p>
    <div className="mt-6 w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-loading-bar"></div>
    </div>
  </div>
);

/* ---------- Error Boundary Component ---------- */
const ErrorBoundaryFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
        <span className="text-xl">❌</span>
      </div>
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-3">Something went wrong</h2>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-700 font-medium mb-1">Error Details:</p>
        <p className="text-red-600 text-sm font-mono break-all">{error.message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={resetErrorBoundary}
          className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = "/"}
          className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  </div>
);

/* ---------- Component Wrapper with Error Boundary ---------- */
function SafeComponent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
    <div className="text-center max-w-md">
      <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center">
        <div className="text-4xl">🔍</div>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Page Not Found</h1>
      <p className="text-slate-600 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/"
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-shadow"
        >
          Go Home
        </a>
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
        >
          Go Back
        </button>
      </div>
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

function RoleAuthGate({ children, allowedRoles }: { children: ReactNode; allowedRoles: string[] }) {
  const { loading, session, userProfile } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  
  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    const actualRole = userProfile?.role || 'student';
    toast.error(`Access denied. You are registered as a ${actualRole}.`);
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

/* ---------- Idle Logout ---------- */
function IdleLogoutManager() {
  const { session } = useAuth();
  return session ? <IdleLogoutEnabled /> : null;
}

function IdleLogoutEnabled() {
  useIdleLogout({
    timeoutMs: 20 * 60 * 1000, // 20 minutes
    warnBeforeMs: 60 * 1000, // 1 minute warning
    onWarn: () => toast.warning("You've been inactive. Auto sign-out in 1 minute."),
    onLogout: () => toast.info("Signed out due to inactivity."),
  });
  return null;
}

/* ========================================================= */

const App = () => {
  // Enhanced prefetch strategy
  useEffect(() => {
    const prefetchResources = () => {
      // Critical pages for instant navigation
      const criticalPages = [
        import("./pages/FeaturesPage"),
        import("./pages/product/PricingPage"),
        import("./pages/DashboardPage"),
        import("./pages/ContestLandingPage"),
        import("./practice/index"),
      ];

      // Secondary pages (prefetch on idle)
      const secondaryPages = () => {
        import("./pages/company/CareersPage");
        import("./pages/Resources/Documentation");
        import("./pages/StudentsPage");
        import("./pages/Notes");
        import("./pages/SettingsPage");
        import("./pages/CoinShop");
        import("./pages/flashcards/FlashcardDashboard");
        import("./pages/RoleSelectionPage");
        import("./pages/StudentDashboardPage");
        import("./pages/TeacherDashboardPage");
        import("./pages/AdminAddQuestions");
        // Note: Removed MegaContestLivePage from automatic prefetch
      };

      // Load critical pages immediately
      Promise.all(criticalPages);

      // Load secondary pages on idle
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => secondaryPages());
      } else {
        setTimeout(secondaryPages, 2000);
      }
    };

    // Start prefetching after initial render
    setTimeout(prefetchResources, 100);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IdleLogoutManager />
        <ThemeProvider>
          <CoinProvider>
            <TooltipProvider>
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'white',
                    color: '#1f2937',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  },
                }}
              />
              <Sonner 
                position="top-right"
                expand={false}
                richColors
                closeButton
              />
              <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
                <BrowserRouter>
                  <ScrollToTop />
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      {/* -------- Auth callback -------- */}
                      <Route path="/auth/callback/*" element={<CallbackPage />} />

                      {/* -------- Role Selection -------- */}
                      <Route path="/role-selection" element={<RoleSelectionPage />} />

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

                      {/* -------- Chemistry Practice -------- */}
                      <Route
                        path="/practice/chemistry"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <ChemistryPracticePage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Resources -------- */}
                      <Route path="/resources" element={<ResourcesHome />} />
                      <Route path="/docs" element={<DocsPage />} />
                      <Route path="/help" element={<HelpCenterPage />} />
                      <Route path="/blog" element={<BlogPage />} />
                      <Route path="/case-studies" element={<CaseStudiesPage />} />

                      {/* -------- Institute -------- */}
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
                            <SafeComponent>
                              <DashboardPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Role-specific Dashboard Pages -------- */}
                      <Route
                        path="/dashboard/student"
                        element={
                          <RoleAuthGate allowedRoles={["student"]}>
                            <SafeComponent>
                              <StudentDashboardPage />
                            </SafeComponent>
                          </RoleAuthGate>
                        }
                      />
                      <Route
                        path="/dashboard/teacher"
                        element={
                          <RoleAuthGate allowedRoles={["teacher"]}>
                            <SafeComponent>
                              <TeacherDashboardPage />
                            </SafeComponent>
                          </RoleAuthGate>
                        }
                      />

                      <Route
                        path="/dashboard/test-generator"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <TestGeneratorPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/dashboard/analytics"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <AnalyticsPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- FLASHCARD ROUTES -------- */}
                      <Route
                        path="/dashboard/flashcards"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <FlashcardDashboard />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/dashboard/flashcards/:subject/:chapter"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <FlashcardChapter />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/dashboard/flashcards/class/:class/subject/:subject"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <FlashcardSubject />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Students / Notes / Settings -------- */}
                      <Route
                        path="/students"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <StudentsPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/notes"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <NotesPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <SettingsPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Practice Routes -------- */}
                      <Route
                        path="/practice/session"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <PracticeSession />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route path="/practice" element={<PracticePage />} />

                      {/* -------- Daily Practice Module -------- */}
                      <Route
                        path="/daily-practice"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <PracticeSelectionPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/daily-practice/session"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <PracticeSession />
                            </SafeComponent>
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
                            <SafeComponent>
                              <ContestLandingPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/contests/create"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <CreateContestPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/contests/join"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <JoinContestPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/contests/live/:contestId"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <ContestLivePage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/contests/leaderboard"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <LeaderboardPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/contests/preview/:contestId"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <ContestPreviewPage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Mega Contest Routes -------- */}
                      <Route
                        path="/mega-contest/:contestId"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <MegaContestLivePage />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin/contest/:contestId/questions"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <AdminAddQuestions />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Coin Shop -------- */}
                      <Route
                        path="/coinshop"
                        element={
                          <PrivateRoute>
                            <SafeComponent>
                              <CoinShop />
                            </SafeComponent>
                          </PrivateRoute>
                        }
                      />

                      {/* -------- Redirect shims -------- */}
                      <Route path="/dashboard/students" element={<Navigate to="/students" replace />} />
                      <Route path="/dashboard/notes" element={<Navigate to="/notes" replace />} />
                      <Route path="/dashboard/settings" element={<Navigate to="/settings" replace />} />
                      <Route path="/dashboard/contests" element={<Navigate to="/contests" replace />} />
                      <Route path="/dashboard/coinshop" element={<Navigate to="/coinshop" replace />} />
                      <Route path="/flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />
                      <Route path="/study/flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />

                      {/* -------- Role-specific redirects -------- */}
                      <Route path="/host-contest" element={<Navigate to="/contests/create" replace />} />
                      <Route path="/join-contest" element={<Navigate to="/contests/join" replace />} />

                      {/* -------- Fallback -------- */}
                      <Route path="/home" element={<Navigate to="/" replace />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <Analytics />
                    <SpeedInsights />
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

// Add CSS animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin-reverse {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-360deg); }
  }
  
  @keyframes loading-bar {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .animate-spin-reverse {
    animation: spin-reverse 1s linear infinite;
  }
  
  .animate-loading-bar {
    animation: loading-bar 1.5s ease-in-out infinite;
  }
  
  /* Smooth transitions */
  * {
    scroll-behavior: smooth;
  }
  
  /* Hide scrollbar for Chrome, Safari and Opera */
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for IE, Edge and Firefox */
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
`;
document.head.appendChild(styleSheet);

export default App;