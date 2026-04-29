// src/pages/TestGeneratorPage.tsx
import React from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import TestGeneratorForm from "@/components/TestGeneratorForm";
import { useAuth } from "@/providers/AuthProvider";
import { useGuestAccess } from "@/hooks/useGuestAccess";
import LoginModal from "@/components/LoginModal";

export default function TestGeneratorPage() {
  const { user } = useAuth();
  const { isGuest, canGenerate, remainingTests, incrementGuestCount, showLoginModal, setShowLoginModal, gateAction, saveTestDataForRestore } = useGuestAccess();
  
  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // This function would be passed to TestGeneratorForm or handled here
  // You'll need to integrate this with your actual generate handler
  const handleGenerate = async (testData: any) => {
    // Add this check at the start of your generate function
    if (isGuest && !canGenerate) {
      setShowLoginModal(true);
      return;
    }

    try {
      // Your existing API call here
      const response = await yourApiCall(testData);
      
      // After successful generation (after API returns data):
      if (isGuest) {
        incrementGuestCount();
      }
      
      return response;
    } catch (error) {
      console.error("Generation failed:", error);
      throw error;
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#F9FAFB] overflow-y-auto font-sans text-[#111827] selection:bg-gray-300">

      {/* BACKGROUND — reduced blur on mobile for perf */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-15%] w-[55vw] h-[55vw] bg-gray-200/50 rounded-full blur-[60px] sm:blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[55vw] h-[55vw] bg-gray-200/50 rounded-full blur-[60px] sm:blur-[120px]" />
      </div>

      {/* TOP HEADER */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl sm:backdrop-blur-2xl border-b border-white/60 shadow-[0_2px_18px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 h-13 sm:h-16 md:h-20 flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0">

            {/* BACK BUTTON */}
            <Link
              to="/dashboard"
              className="group flex items-center gap-1.5 sm:gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 active:text-gray-800 transition-colors flex-shrink-0 -webkit-tap-highlight-color-transparent"
            >
              <div className="p-1.5 sm:p-2 rounded-full bg-white border border-gray-200 shadow-sm group-hover:border-gray-300 group-active:border-gray-400 transition-all min-w-[28px] min-h-[28px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center">
                <ChevronLeft size={14} />
              </div>
              <span className="hidden sm:inline">Back</span>
            </Link>

            {/* DIVIDER */}
            <div className="h-5 sm:h-6 md:h-8 w-px bg-gray-200 flex-shrink-0" />

            {/* LOGO + TITLE SECTION */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
              
              {/* LOGO IMAGE - BADA VERSION */}
              <div className="flex-shrink-0">
                <img 
                  src="/images/LOGO.png" 
                  alt="A4AI Logo" 
                  className="h-10 sm:h-12 md:h-14 w-auto object-contain"  // 👈 BADA KAR DIYA
                />
              </div>

              {/* TITLE - Agar sirf logo dikhana hai toh yeh section hata do */}
              <div className="min-w-0">
                <h1 className="text-[13px] sm:text-base md:text-xl font-bold tracking-tight text-[#111827] truncate leading-tight">
                  a4ai
                  <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#111827] to-[#374151]">
                    Engine V1   
                  </span>
                </h1>
                <p className="text-[9px] sm:text-[10px] md:text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:block">
                  Test Generator
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — Profile */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-[#111827]">{displayName}</p>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full inline-block">
                Pro Plan
              </p>
            </div>

            <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-[#111827] to-[#374151] flex items-center justify-center text-white text-[11px] sm:text-xs md:text-sm font-bold shadow-md ring-2 ring-white">
              {initials}
            </div>
          </div>

        </div>
      </header>

      {/* MAIN CONTENT — extra bottom padding for sticky bar */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-3 sm:py-6 md:py-10 pb-28 sm:pb-36 md:pb-40">
        {/* Guest Banner */}
        {isGuest && (
          <div className="mb-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-indigo-900 text-sm">🎯 Demo Mode</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                {remainingTests > 0 
                  ? `${remainingTests} free test${remainingTests > 1 ? 's' : ''} remaining — no login needed!`
                  : 'Login to generate more tests'
                }
              </p>
            </div>
            {remainingTests === 0 && (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
              >
                Login
              </button>
            )}
          </div>
        )}
        
        <TestGeneratorForm onGenerate={handleGenerate} />
      </main>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
        action="generate"
        onLoginSuccess={() => {
          setShowLoginModal(false);
          // User is now logged in, they can continue
        }}
      />

    </div>
  );
}