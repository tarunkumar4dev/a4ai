// src/pages/TestGeneratorPage.tsx
import React from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import TestGeneratorForm from "@/components/TestGeneratorForm";

export default function TestGeneratorPage() {
  return (
    <div className="fixed inset-0 w-full h-full bg-[#F9FAFB] overflow-y-auto font-sans text-[#111827] selection:bg-gray-300">

      {/* BACKGROUND GLASS BLURS */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-15%] w-[55vw] h-[55vw] bg-gray-200/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[55vw] h-[55vw] bg-gray-200/50 rounded-full blur-[120px]" />
      </div>

      {/* ================================
           🔥 TOP HEADER (COMPLETE)
      ================================= */}
      <header className="sticky top-0 z-50 w-full 
        bg-white/80 backdrop-blur-2xl 
        border-b border-white/60 shadow-[0_2px_18px_rgba(0,0,0,0.04)]">

        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 
          flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-6">

            {/* BACK BUTTON */}
            <Link 
              to="/dashboard"
              className="group flex items-center gap-2 
                text-xs font-bold uppercase tracking-wider 
                text-gray-400 hover:text-gray-700 transition-colors"
            >
              <div className="p-2 rounded-full bg-white 
                border border-gray-200 shadow-sm 
                group-hover:border-gray-300 group-hover:shadow-md transition-all">
                <ChevronLeft size={14} />
              </div>
              Back
            </Link>

            {/* DIVIDER */}
            <div className="h-8 w-px bg-gray-200" />

            {/* TITLE SECTION */}
            <div className="flex items-center gap-3">
              {/* ICON GRADIENT BUBBLE */}
              <div className="p-2.5 rounded-xl 
                bg-gradient-to-br from-[#111827] to-[#1F2937] 
                shadow-lg shadow-gray-900/20 text-white">
                <Sparkles size={18} className="opacity-90" />
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                  Test Engine{" "}
                  <span className="text-transparent bg-clip-text 
                    bg-gradient-to-br from-[#111827] to-[#374151]">
                    V4 Pro
                  </span>
                </h1>

                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  A4AI Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-[#111827]">Dr. Anjali S.</p>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide 
                bg-gray-100 px-2 py-0.5 rounded-full inline-block">
                Pro Plan
              </p>
            </div>

            <div className="h-10 w-10 rounded-full 
              bg-gradient-to-br from-[#111827] to-[#374151] 
              flex items-center justify-center text-white font-bold 
              shadow-md ring-2 ring-white">
              AS
            </div>
          </div>

        </div>
      </header>

      {/* ================================
            MAIN CONTENT
      ================================= */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-8 py-10 pb-40">
        <TestGeneratorForm />
      </main>

    </div>
  );
}
