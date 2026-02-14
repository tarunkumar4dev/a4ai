// src/App.tsx
import { useEffect, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import "./styles/globals.css";

import ChankyaInstitutePublic from "@/pages/institute/chanakya";
/* -------- Core Imports -------- */
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
const LAZY_LOADING_DELAY = 1000; 

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

const SubjectHubPage = lazy(() => import("@/practice/SubjectHub")); 

/* ---------- Lazy Auth & App Pages ---------- */
const RoleSelectionPage = lazy(() => import("./pages/RoleSelectionPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const StudentDashboardPage = lazy(() => import("./pages/StudentDashboardPage"));
const TeacherDashboardPage = lazy(() => import("./pages/TeacherDashboardPage"));
const TestGeneratorPage = lazy(() => import("./pages/TestGeneratorPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

/* ---------- NEW QUIZ PAGE ---------- */
const QuizPage = lazy(() => import("./pages/Quiz")); // <--- ADDED THIS

/* ---------- Lazy PYQ Practice Pages ---------- */
const PracticeZonePage = lazy(() => import("./pages/PracticeZonePage"));
const PYQPracticeSessionPage = lazy(() => import("./pages/PYQPracticeSessionPage"));
const PYQAdminPage = lazy(() => import("./pages/admin/PYQAdminPage"));

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
const MegaContestLivePage = lazy(() => 
  import("./pages/MegaContestLivePage")
    .then(module => ({ default: module.default }))
    .catch(error => {
      console.error("Failed to load MegaContestLivePage:", error);
      return {
        default: () => (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Component Loading Error</h2>
              <p className="text-gray-600 mb-6">The contest page could not be loaded.</p>
              <button onClick={() => window.location.href = "/contests"} className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">Back to Contests</button>
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
const PracticeSelectionPage = lazy(() => import("@/practice/index")); 
// CRITICAL FIX: Explicitly pointing to 'index' ensures we skip the old 'session.tsx' file
const PracticeSessionPage = lazy(() => import("@/practice/session/index")); 

/* ---------- Practice page alias ---------- */
const PracticePage = lazy(() => import("@/practice/index"));

/* ---------- Scroll Helper ---------- */
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
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
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
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
  </div>
);

const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
    <div className="text-center max-w-md">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Page Not Found</h1>
      <p className="text-slate-600 mb-8">The page you're looking for doesn't exist.</p>
      <div className="flex gap-3 justify-center">
        <a href="/" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl">Go Home</a>
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
    timeoutMs: 20 * 60 * 1000,
    warnBeforeMs: 60 * 1000,
    onWarn: () => toast.warning("You've been inactive. Auto sign-out in 1 minute."),
    onLogout: () => toast.info("Signed out due to inactivity."),
  });
  return null;
}

/* ========================================================= */

const App = () => {
  useEffect(() => {
    // Prefetch logic...
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IdleLogoutManager />
        <ThemeProvider>
          <CoinProvider>
            <TooltipProvider>
              <Toaster position="top-right" />
              <Sonner position="top-right" expand={false} richColors closeButton />
              
              <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
                <BrowserRouter>
                  <ScrollToTop />
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      {/* Public & Auth Routes */}
                      <Route path="/auth/callback/*" element={<CallbackPage />} />
                      <Route path="/role-selection" element={<RoleSelectionPage />} />
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/features" element={<FeaturesPage />} />
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/api" element={<ApiPage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/payment" element={<PaymentPage />} />
                      <Route path="/careers" element={<CareersPage />} />
                      <Route path="/privacy" element={<PrivacyPolicyPage />} />
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/cookies" element={<CookiePolicyPage />} />
                      <Route path="/resources" element={<ResourcesHome />} />
                      <Route path="/docs" element={<DocsPage />} />
                      <Route path="/help" element={<HelpCenterPage />} />
                      <Route path="/blog" element={<BlogPage />} />
                      <Route path="/case-studies" element={<CaseStudiesPage />} />
                      <Route path="/demo" element={<LandingDemo />} />
                      <Route path="/faq" element={<FAQ />} />
                      <Route path="/login" element={<AuthGateForAuthPages><LoginPage /></AuthGateForAuthPages>} />
                      <Route path="/signup" element={<AuthGateForAuthPages><SignupPage /></AuthGateForAuthPages>} />

                      {/* Dashboard Routes */}
                      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
                      <Route path="/dashboard/student" element={<RoleAuthGate allowedRoles={["student"]}><StudentDashboardPage /></RoleAuthGate>} />
                      <Route path="/dashboard/teacher" element={<RoleAuthGate allowedRoles={["teacher"]}><TeacherDashboardPage /></RoleAuthGate>} />
                      <Route path="/dashboard/test-generator" element={<PrivateRoute><TestGeneratorPage /></PrivateRoute>} />
                      <Route path="/dashboard/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
                      
                      {/* === ADDED QUIZ ROUTE HERE === */}
                      <Route path="/quiz" element={<PrivateRoute><QuizPage /></PrivateRoute>} /> 
                      {/* Alternatively, if you want it under dashboard: */}
                      {/* <Route path="/dashboard/quiz" element={<PrivateRoute><QuizPage /></PrivateRoute>} /> */}

                      {/* Practice & PYQ Routes */}
                      <Route path="/practice/zone" element={<PrivateRoute><PracticeZonePage /></PrivateRoute>} />
                      <Route path="/practice/pyq-session" element={<PrivateRoute><PYQPracticeSessionPage /></PrivateRoute>} />
                      <Route path="/admin/pyq" element={<RoleAuthGate allowedRoles={["teacher", "admin"]}><PYQAdminPage /></RoleAuthGate>} />
                      
                      {/* === UPDATED PRACTICE ROUTES === */}
                      <Route path="/dashboard/practice" element={<PrivateRoute><PracticePage /></PrivateRoute>} />
                      <Route path="/practice" element={<PracticePage />} />
                      <Route path="/practice/chemistry" element={<PrivateRoute><SubjectHubPage /></PrivateRoute>} />
                      
                      {/* IMPORTANT: Both URLs now point to the NEW session file */}
                      <Route path="/practice/session" element={<PrivateRoute><PracticeSessionPage /></PrivateRoute>} /> 
                      <Route path="/daily-practice" element={<PrivateRoute><PracticeSelectionPage /></PrivateRoute>} />
                      <Route path="/daily-practice/session" element={<PrivateRoute><PracticeSessionPage /></PrivateRoute>} /> 
                      
                      {/* Flashcards */}
                      <Route path="/dashboard/flashcards" element={<PrivateRoute><FlashcardDashboard /></PrivateRoute>} />
                      <Route path="/dashboard/flashcards/:subject/:chapter" element={<PrivateRoute><FlashcardChapter /></PrivateRoute>} />
                      <Route path="/dashboard/flashcards/class/:class/subject/:subject" element={<PrivateRoute><FlashcardSubject /></PrivateRoute>} />
                      
                      {/* Others */}
                      <Route path="/students" element={<PrivateRoute><StudentsPage /></PrivateRoute>} />
                      <Route path="/notes" element={<PrivateRoute><NotesPage /></PrivateRoute>} />
                      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                      
                      {/* Contests */}
                      <Route path="/contests/math-weekly" element={<JoinContestPageAurora />} />
                      <Route path="/contests/sci-lab" element={<JoinContestPageAurora />} />
                      <Route path="/contests/gk-rapid" element={<JoinContestPageAurora />} />
                      <Route path="rules" element={<Rules />} />
                      <Route path="/contests" element={<PrivateRoute><ContestLandingPage /></PrivateRoute>} />
                      <Route path="/contests/create" element={<PrivateRoute><CreateContestPage /></PrivateRoute>} />
                      <Route path="/contests/join" element={<PrivateRoute><JoinContestPage /></PrivateRoute>} />
                      <Route path="/contests/live/:contestId" element={<PrivateRoute><ContestLivePage /></PrivateRoute>} />
                      <Route path="/contests/leaderboard" element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} />
                      <Route path="/contests/preview/:contestId" element={<PrivateRoute><ContestPreviewPage /></PrivateRoute>} />
                      <Route path="/mega-contest/:contestId" element={<PrivateRoute><MegaContestLivePage /></PrivateRoute>} />
                      <Route path="/admin/contest/:contestId/questions" element={<PrivateRoute><AdminAddQuestions /></PrivateRoute>} />
                      <Route path="/coinshop" element={<PrivateRoute><CoinShop /></PrivateRoute>} />
                      
                      {/* Redirects */}
                      <Route path="/dashboard/students" element={<Navigate to="/students" replace />} />
                      <Route path="/dashboard/notes" element={<Navigate to="/notes" replace />} />
                      <Route path="/dashboard/settings" element={<Navigate to="/settings" replace />} />
                      <Route path="/dashboard/contests" element={<Navigate to="/contests" replace />} />
                      <Route path="/dashboard/coinshop" element={<Navigate to="/coinshop" replace />} />
                      <Route path="/flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />
                      <Route path="/study/flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />
                      <Route path="/home" element={<Navigate to="/" replace />} />
                      
                      {/* Catch-All */}
                      <Route path="/*" element={<ChankyaInstitutePublic />} />
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
`;
document.head.appendChild(styleSheet);

export default App;
