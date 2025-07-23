import FeaturesPage from "./pages/FeaturesPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";

//above code added on 21/06/2025

import Comingsoon from "./pages/Comingsoon";

const isProduction = import.meta.env.MODE === 'production';
const showLanding = import.meta.env.VITE_SHOW_LAUNCH_PAGE === 'true';

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import TestGeneratorPage from "./pages/TestGeneratorPage";
// import PricingPage from "./pages/pricing";
// import NotFound from "./pages/NotFound";
// import DemoPage from "./pages/demo";
// import APIPage from "./pages/api";
// import DocumentationPage from "./pages/documentation";
// import HelpCentrePage from "./pages/help";
// import BlogPage from "./pages/blogs";
// import CaseStudiesPage from "./pages/case studies";
// import CareersPage from "./pages/careers";
// import PrivacyPolicyPage from "./pages/privacy";

const queryClient = new QueryClient();

const App = () => {
  if (isProduction && showLanding) {
    return <Comingsoon />;
  }
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
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/test-generator" element={<TestGeneratorPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            {/* <Route path="/pricing" element={<PricingPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/api" element={<APIPage />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/documentation" element={<DocumentationPage />} />
            <Route path="/help" element={<HelpCentrePage />} />
            <Route path="/case studies" element={<CaseStudiesPage />} />
            <Route path="/blogs" element={<BlogPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} /> */}

          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;