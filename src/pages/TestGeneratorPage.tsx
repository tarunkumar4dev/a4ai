// src/pages/TestGeneratorPage.tsx
import React from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import TestGeneratorForm from "@/components/TestGeneratorForm";
import { useAuth } from "@/providers/AuthProvider";

export default function TestGeneratorPage() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 w-full h-full bg-[#F9FAFB] overflow-y-auto font-sans text-[#111827] selection:bg-gray-300">

      {/* BACKGROUND GLASS BLURS */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-15%] w-[55vw] h-[55vw] bg-gray-200/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[55vw] h-[55vw] bg-gray-200/50 rounded-full blur-[120px]" />
      </div>

      {/* TOP HEADER */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-2xl border-b border-white/60 shadow-[0_2px_18px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 h-14 sm:h-16 md:h-20 flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0">

            {/* BACK BUTTON */}
            <Link
              to="/dashboard"
              className="group flex items-center gap-1.5 sm:gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              <div className="p-1.5 sm:p-2 rounded-full bg-white border border-gray-200 shadow-sm group-hover:border-gray-300 group-hover:shadow-md transition-all">
                <ChevronLeft size={12} className="sm:hidden" />
                <ChevronLeft size={14} className="hidden sm:block" />
              </div>
              <span className="hidden sm:inline">Back</span>
            </Link>

            {/* DIVIDER */}
            <div className="h-6 sm:h-8 w-px bg-gray-200 flex-shrink-0" />

            {/* TITLE SECTION */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#111827] to-[#1F2937] shadow-lg shadow-gray-900/20 text-white flex-shrink-0">
                <Sparkles size={14} className="sm:hidden opacity-90" />
                <Sparkles size={16} className="hidden sm:block md:hidden opacity-90" />
                <Sparkles size={18} className="hidden md:block opacity-90" />
              </div>

              <div className="min-w-0">
                <h1 className="text-sm sm:text-base md:text-xl font-bold tracking-tight text-[#111827] truncate">
                  Test Engine{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#111827] to-[#374151]">
                    V4 Pro
                  </span>
                </h1>
                <p className="text-[9px] sm:text-[10px] md:text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:block">
                  A4AI Intelligence
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

            <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-[#111827] to-[#374151] flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-md ring-2 ring-white">
              {initials}
            </div>
          </div>

        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 sm:py-6 md:py-10 pb-32 sm:pb-36 md:pb-40">
        <TestGeneratorForm />
      </main>

    </div>
  );
}