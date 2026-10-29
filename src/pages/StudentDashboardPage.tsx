// src/pages/StudentDashboardPage.tsx — home for students with an a4ai account.
// Every card opens a feature that exists for students (contests, practice,
// notes, flashcards, leaderboard, coin shop, the school portal). No sample data,
// no animation: plain links and one small profile menu.
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Coins,
  Flame,
  KeyRound,
  Layers,
  LayoutGrid,
  LogOut,
  Settings,
  Target,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";
import StaticSarthi from "@/components/chat/StaticSarthi";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/hooks/useUserProfile";

const ScratchCard = lazy(() => import("@/components/ScratchCard"));

const T = {
  en: {
    home: "Home",
    contests: "Contests",
    practice: "Practice",
    notes: "Notes",
    flashcards: "Flashcards",
    leaderboard: "Leaderboard",
    settings: "Settings",
    logOut: "Log out",
    welcome: "Welcome back",
    joinTitle: "Join a live contest",
    joinBody: "Got a contest code from your teacher? Enter it and start.",
    joinCta: "Enter contest code",
    toolsTitle: "Keep practising",
    schoolTitle: "Code from your school?",
    schoolBody: "Open the student portal to see your assignments and results.",
    schoolCta: "Open student portal",
    language: "हिंदी",
    tools: {
      practice: ["Practice zone", "Previous-year questions, chapter by chapter"],
      daily: ["Daily practice", "A short set of questions every day"],
      notes: ["My notes", "Your study notes in one place"],
      flashcards: ["Flashcards", "Quick revision cards"],
      leaderboard: ["Leaderboard", "See where you stand in contests"],
      coins: ["Coin shop", "Spend the coins you earn"],
    },
  },
  hi: {
    home: "होम",
    contests: "प्रतियोगिताएं",
    practice: "अभ्यास",
    notes: "नोट्स",
    flashcards: "फ़्लैशकार्ड",
    leaderboard: "लीडरबोर्ड",
    settings: "सेटिंग्स",
    logOut: "लॉग आउट",
    welcome: "वापसी पर स्वागत है",
    joinTitle: "लाइव प्रतियोगिता में शामिल हों",
    joinBody: "टीचर से प्रतियोगिता कोड मिला है? कोड डालें और शुरू करें।",
    joinCta: "प्रतियोगिता कोड डालें",
    toolsTitle: "अभ्यास जारी रखें",
    schoolTitle: "स्कूल से कोड मिला है?",
    schoolBody: "अपने असाइनमेंट और रिज़ल्ट देखने के लिए स्टूडेंट पोर्टल खोलें।",
    schoolCta: "स्टूडेंट पोर्टल खोलें",
    language: "English",
    tools: {
      practice: ["प्रैक्टिस ज़ोन", "पिछले वर्षों के प्रश्न, अध्याय अनुसार"],
      daily: ["रोज़ का अभ्यास", "हर दिन कुछ प्रश्न"],
      notes: ["मेरे नोट्स", "आपके नोट्स एक जगह"],
      flashcards: ["फ़्लैशकार्ड", "जल्दी दोहराने के कार्ड"],
      leaderboard: ["लीडरबोर्ड", "प्रतियोगिताओं में आपकी रैंक"],
      coins: ["कॉइन शॉप", "कमाए हुए कॉइन इस्तेमाल करें"],
    },
  },
};
type Lang = keyof typeof T;

const NAV: { to: string; key: "home" | "contests" | "practice" | "notes" | "flashcards" | "leaderboard"; Icon: LucideIcon }[] = [
  { to: "/student/dashboard", key: "home", Icon: LayoutGrid },
  { to: "/contests", key: "contests", Icon: Trophy },
  { to: "/practice/zone", key: "practice", Icon: Target },
  { to: "/notes", key: "notes", Icon: BookOpen },
  { to: "/dashboard/flashcards", key: "flashcards", Icon: Layers },
  { to: "/contests/leaderboard", key: "leaderboard", Icon: Flame },
];

const TOOLS: { to: string; key: keyof (typeof T)["en"]["tools"]; Icon: LucideIcon; bg: string; accent: string }[] = [
  { to: "/practice/zone", key: "practice", Icon: Target, bg: "linear-gradient(135deg,#FFEDEF,#FFD9DE)", accent: "#D93F4D" },
  { to: "/daily-practice", key: "daily", Icon: Flame, bg: "linear-gradient(135deg,#FFF1E3,#FFDDBE)", accent: "#C2410C" },
  { to: "/notes", key: "notes", Icon: BookOpen, bg: "linear-gradient(135deg,#EEF7D6,#DCEDB5)", accent: "#4D7C0F" },
  { to: "/dashboard/flashcards", key: "flashcards", Icon: Layers, bg: "linear-gradient(135deg,#EFEDFF,#DCD7FF)", accent: "#5B4BC4" },
  { to: "/contests/leaderboard", key: "leaderboard", Icon: Trophy, bg: "linear-gradient(135deg,#FFF7D9,#FFE9AD)", accent: "#9A6B00" },
  { to: "/coinshop", key: "coins", Icon: Coins, bg: "linear-gradient(135deg,#E4F8F3,#C9EFE4)", accent: "#047857" },
];

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[24px] border border-[#E5E7EB] bg-white p-5 sm:p-6 ${className}`}>{children}</div>;
}

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useUserProfile();
  const [lang, setLang] = useState<Lang>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScratchCard, setShowScratchCard] = useState(false);
  const t = T[lang];

  // Welcome coins for a brand-new account (same rule as before).
  useEffect(() => {
    if (loading || !profile) return;
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem("hasSeenCoinPopup"));
    } catch {
      /* storage unavailable */
    }
    if (searchParams.get("newUser") === "true" && !seen) setShowScratchCard(true);
  }, [loading, profile, searchParams]);

  const firstName = (profile?.full_name || "").split(" ")[0];
  const today = new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" });
  const signOut = () => supabase.auth.signOut().then(() => navigate("/login"));

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] text-[#5D6570]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1B1B1B]">
      <Suspense fallback={null}>
        {showScratchCard && <ScratchCard isOpen={showScratchCard} onClose={() => setShowScratchCard(false)} coins={100} />}
      </Suspense>

      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col border-r border-[#E5E7EB] bg-white p-5 lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-2.5 px-2">
          <img src="/ICON.ico" alt="" width={36} height={36} className="h-9 w-9" />
          <span className="text-xl font-bold">a4ai</span>
        </Link>
        <nav aria-label="Student" className="flex-1 space-y-1">
          {NAV.map(({ to, key, Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold ${
                  active ? "bg-[#111111] text-white" : "text-[#374151] hover:bg-[#F7F8FA]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {t[key]}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-[#E5E7EB] pt-3">
          <Link to="/settings" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-[#374151] hover:bg-[#F7F8FA]">
            <Settings className="h-[18px] w-[18px]" aria-hidden="true" /> {t.settings}
          </Link>
          <button type="button" onClick={signOut} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-[#B42318] hover:bg-[#FFF1F0]">
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" /> {t.logOut}
          </button>
        </div>
      </aside>

      <div className="lg:pl-[240px]">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <img src="/ICON.ico" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold">a4ai</span>
          </Link>
          <span className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))}
              className="min-h-[40px] rounded-xl border border-[#E5E7EB] px-3 text-[14px] font-semibold text-[#374151] hover:bg-[#F7F8FA]"
            >
              {t.language}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] hover:bg-[#F7F8FA]"
              >
                <User className="h-4 w-4" aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg">
                  <Link to="/settings" className="block rounded-lg px-3 py-2 text-[14px] font-medium hover:bg-[#F7F8FA]">
                    {t.settings}
                  </Link>
                  <button type="button" onClick={signOut} className="block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium text-[#B42318] hover:bg-[#FFF1F0]">
                    {t.logOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1100px] px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:pt-8">
          <h1 className="font-halenoir text-2xl font-bold tracking-[-0.01em] sm:text-[1.9rem]">
            {t.welcome}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-[14px] text-[#5D6570]">{today}</p>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="rounded-[24px] p-6 sm:p-8" style={{ backgroundImage: "linear-gradient(135deg,#FFE3EC,#FFC9DB)" }}>
              <Trophy className="h-7 w-7 text-[#BE185D]" aria-hidden="true" />
              <h2 className="mt-3 font-halenoir text-xl font-bold sm:text-2xl">{t.joinTitle}</h2>
              <p className="mt-1.5 max-w-md text-[15px] text-[#374151]">{t.joinBody}</p>
              <Link
                to="/contests/join"
                className="mt-5 inline-flex min-h-[46px] items-center rounded-xl bg-[#111111] px-5 text-[15px] font-bold text-white hover:bg-[#222222]"
              >
                {t.joinCta}
              </Link>
            </div>

            <Card>
              <KeyRound className="h-6 w-6 text-[#5B4BC4]" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-bold">{t.schoolTitle}</h2>
              <p className="mt-1 text-[14px] text-[#5D6570]">{t.schoolBody}</p>
              <Link to="/student" className="mt-4 inline-flex min-h-[44px] items-center text-[15px] font-bold underline underline-offset-4">
                {t.schoolCta}
              </Link>
            </Card>
          </div>

          <h2 className="mt-9 text-lg font-bold">{t.toolsTitle}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ to, key, Icon, bg, accent }) => (
              <li key={key}>
                <Link to={to} className="flex h-full items-start gap-4 rounded-[20px] border border-black/[0.04] p-5" style={{ backgroundImage: bg }}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80" style={{ color: accent }}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[16px] font-bold">{t.tools[key][0]}</span>
                    <span className="mt-0.5 block text-[14px] text-[#374151]">{t.tools[key][1]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </div>

      {/* Bottom nav (phones) */}
      <nav aria-label="Student" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#E5E7EB] bg-white lg:hidden">
        {NAV.filter((n) => n.key !== "flashcards").map(({ to, key, Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-[#D93F4D]" : "text-[#5D6570]"}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {t[key]}
            </Link>
          );
        })}
      </nav>

      <StaticSarthi variant="student" aboveBottomNav />
    </div>
  );
}
