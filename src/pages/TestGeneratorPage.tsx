// src/pages/TestGeneratorPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { BookOpen, ClipboardCheck, FileUp, Wand2, type LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import TestGeneratorForm from "@/components/TestGeneratorForm";
import TestBuilderPage from "./TestBuilderPage";
import { useAuth } from "@/providers/AuthProvider";
import { useGuestAccess } from "@/hooks/useGuestAccess";
import LoginModal from "@/components/LoginModal";
import CopyChecker from "@/components/checker/CopyChecker";
import ImportContestFromPdf from "@/components/contest/ImportContestFromPdf";

type Tab = "ai" | "builder" | "check" | "contest-pdf";
const TABS: Tab[] = ["ai", "builder", "check", "contest-pdf"];

export default function TestGeneratorPage() {
  const { user } = useAuth();
  const {
    isGuest,
    canGenerate,
    remainingTests,
    incrementGuestCount,
    showLoginModal,
    setShowLoginModal,
  } = useGuestAccess();

  // ?tab=check opens "Check Answer Sheets"; &test=<id> starts a check for that saved test (Test History button)
  // ?tab=contest-pdf opens "Contest from PDF" (also linked from /contests)
  const [params, setParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    const t = params.get("tab") as Tab | null;
    return t && TABS.includes(t) ? t : "ai";
  });
  const checkTestId = params.get("test");
  const setActiveTab = (t: Tab) => {
    setActiveTabState(t);
    const next = new URLSearchParams(params);
    if (t === "ai") next.delete("tab"); else next.set("tab", t);
    next.delete("test");
    setParams(next, { replace: true });
  };

  // phones: the 4th tab sits off-screen in the scrolling tab bar — keep the active one visible
  const tabBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabBar.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab]);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 w-full h-full bg-[#F7F8FA] overflow-y-auto font-halenoir text-[#1B1B1B] selection:bg-gray-300">

      {/* TOP HEADER */}
      {/* Solid background: lite mode (src/styles/lite.css) turns backdrop blur off, and a see-through header let the
          tabs show through it while scrolling. */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-[0_2px_18px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 h-13 sm:h-16 md:h-20 flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0">

            {/* BACK BUTTON */}
            <Link
              to="/dashboard"
              className="group flex items-center gap-1.5 sm:gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 active:text-gray-800 transition-colors flex-shrink-0"
            >
              <div className="p-1.5 sm:p-2 rounded-full bg-white border border-gray-200 shadow-sm group-hover:border-gray-300 group-active:border-gray-400 transition-all min-w-[28px] min-h-[28px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center">
                <ChevronLeft size={14} />
              </div>
              <span className="hidden sm:inline">Back</span>
            </Link>

            {/* DIVIDER */}
            <div className="h-5 sm:h-6 md:h-8 w-px bg-gray-200 flex-shrink-0" />

            {/* LOGO + TITLE */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
              <div className="flex-shrink-0">
                <img
                  src="/images/LOGO.png"
                  alt="A4AI Logo"
                  className="h-10 sm:h-12 md:h-14 w-auto object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-[13px] sm:text-base md:text-xl font-bold tracking-tight text-[#1B1B1B] truncate leading-tight">
                  a4ai
                  <span className="text-[#1B1B1B]">
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
            </div>
            <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full bg-[#111111] flex items-center justify-center text-white text-[11px] sm:text-xs md:text-sm font-bold shadow-md ring-2 ring-white">
              {initials}
            </div>
          </div>

        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-3 sm:py-6 md:py-10 pb-28 sm:pb-36 md:pb-40">

        {/* TABS */}
        <div ref={tabBar} className="flex gap-2 mb-6 overflow-x-auto no-scrollbar -mx-1 px-1">
          {([
            ["builder", "NCERT Test Builder", BookOpen],
            ["check", "Check Answer Sheets", ClipboardCheck],
            ["ai", "AI Generator", Wand2],
            ["contest-pdf", "Contest from PDF", FileUp],
          ] as [Tab, string, LucideIcon][]).map(([k, label, Icon]) => (
            <button
              key={k}
              data-tab={k}
              onClick={() => setActiveTab(k)}
              className={`shrink-0 min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                activeTab === k
                  ? "bg-[#111111] text-white shadow"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              <span className="inline-flex items-center gap-1.5"><Icon size={15} /> {label}</span>
            </button>
          ))}
        </div>

        {activeTab === "ai" ? (
          <>
            {/* Guest Banner */}
            {isGuest && (
              <div className="mb-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-indigo-900 text-sm">Demo mode</p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    {remainingTests > 0
                      ? `${remainingTests} free test${remainingTests > 1 ? "s" : ""} remaining — no login needed!`
                      : "Login to generate more tests"}
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

            <TestGeneratorForm
              canGenerate={!isGuest || canGenerate}
              onBlocked={() => setShowLoginModal(true)}
              onGenerated={() => { if (isGuest) incrementGuestCount(); }}
            />
          </>
        ) : activeTab === "builder" ? (
          <TestBuilderPage />
        ) : activeTab === "contest-pdf" ? (
          <ImportContestFromPdf />
        ) : (
          <CopyChecker
            initialTestId={checkTestId}
            onConsumeTestId={() => { const n = new URLSearchParams(params); n.delete("test"); setParams(n, { replace: true }); }}
          />
        )}

      </main>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        action="generate"
        onLoginSuccess={() => setShowLoginModal(false)}
      />

    </div>
  );
}