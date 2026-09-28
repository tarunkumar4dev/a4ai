import React, { lazy, Suspense, memo } from "react";
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
const LandingDemo = lazy(() => import(/* webpackPrefetch: true */ "@/components/LandingDemo"));
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Sparkles,
  FileText,
  Download,
  Settings,
  User,
  Crown,
  ShieldCheck,
  Zap,
  Lock,
  SlidersHorizontal,
  Brain,
  Youtube,
  Grid,
  BookOpen,
  Search,
  Wand2
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

/* ── Data ── */
const HOW_STEPS = Object.freeze([
  { title: "Set Your Paper", desc: "Pick subject, class, chapters, marks distribution, and question types.", Icon: Settings },
  { title: "Generate from 1 Lakh+ NCERT", desc: "Questions are pulled directly from our bank of 1 Lakh+ NCERT questions — chapter-accurate, Bloom's-tagged.", Icon: FileText },
  { title: "Download & Print", desc: "Get a CBSE-pattern PDF or DOCX with sections, marks, and answer key.", Icon: Download },
]);
const TRUST_FEATURES = Object.freeze([
  { title: "Encryption", desc: "Data encrypted in transit and at rest with modern standards.", Icon: Lock },
  { title: "Privacy-First", desc: "No ads, no selling data. You control retention and export.", Icon: ShieldCheck },
  { title: "Reliability", desc: "Monitored uptime and graceful fallbacks during peak load.", Icon: Zap },
  { title: "Controls", desc: "Role-based access, per-class sharing, and one-click export.", Icon: SlidersHorizontal },
]);
const OUTCOME_STATS = Object.freeze([
  { value: "1 Lakh+", label: "NCERT Questions", description: "Classes 6–12 CBSE curriculum aligned" },
  { value: "PDF & Word", label: "Export Options", description: "Print-ready or share digitally" },
  { value: "<2 min", label: "Per Paper", description: "Full CBSE-pattern test paper" },
]);
const TESTIMONIALS = Object.freeze([
  { quote: "a4ai has saved me hours every week. The questions actually match what's in the NCERT textbook — no random internet stuff.", name: "Rahul Verma", role: "Director, Education Beast" },
  { quote: "Perfect for creating differentiated assessments. I set chapters and difficulty, and the paper comes out section-wise ready to print.", name: "Abhay Gupta", role: "Director, Chanakya Institute" },
  { quote: "Surprised by the accuracy. Questions come straight from NCERT content with proper Bloom's levels. Saves me 3-4 hours per week.", name: "Aman Singh", role: "Chemistry Teacher (10+ Years Exp)" },
]);

/* ══════════════════════════════════════════════
   ERROR BOUNDARY
   ══════════════════════════════════════════════ */
class Safe extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; label?: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown, info: unknown) {
    console.error(`[a4ai] Section "${this.props.label ?? "section"}" failed:`, err, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

const txtMuted = "#5f6368";
const txtHead = "#111111";
const accentColor = "#f75961";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white" style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Navbar />
      <main className="flex-grow bg-white">
        <Safe label="Hero" fallback={<LandingHero />}>
          <LandingHero />
        </Safe>

        <Safe label="LandingDemo">
          <Suspense fallback={<div className="h-48 sm:h-96 bg-white" />}>
            <LandingDemo videoSrcMp4="/demo.mp4" />
          </Suspense>
        </Safe>

        <Safe label="AiToolsSuite">
          <AiToolsSuite />
        </Safe>

        <Safe label="HowItWorks">
          <HowItWorks />
        </Safe>
        <Safe label="UpgradedCTA">
          <UpgradedCTA />
        </Safe>
        <Safe label="TrustSecurity">
          <TrustSecurity />
        </Safe>
        <Safe label="Outcomes">
          <Outcomes />
        </Safe>
        <Safe label="Testimonials">
          <Testimonials />
        </Safe>
        <Safe label="FinalCTA">
          <FinalCTA />
        </Safe>
      </main>
      <Footer />
    </div>
  );
}

/* ── AI TOOLS SUITE ── */
const AI_TOOLS_DATA = [
  {
    icon: Wand2,
    badge: "MAGICAL AI",
    badgeColor: "bg-amber-100 text-amber-900 border border-amber-200",
    title: "AI Paper Checker",
    tagline: "Instant answer sheet & assignment grading",
    desc: "Magically scan and auto-grade student handwritten copies and tests with question-by-question scoring and rubric feedback.",
    cta: "Check Papers",
    href: "/dashboard/test-checker",
    highlights: ["Handwritten copies supported", "Rubric & step-wise grading", "Instant student analysis"],
    isHighlight: true,
  },
  {
    icon: Brain,
    badge: "1 LAKH+ NCERT",
    badgeColor: "bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]",
    title: "Test Generator",
    tagline: "CBSE & State Board papers in < 2 mins",
    desc: "Pick subject, chapters, and question types. Generates a balanced, print-ready PDF or Word doc with complete answer keys.",
    cta: "Create Test",
    href: "/dashboard/test-generator",
    highlights: ["Bloom's taxonomy spread", "Bilingual English/Hindi", "1-click PDF/DOCX export"],
    isHighlight: false,
  },
  {
    icon: Youtube,
    badge: "POPULAR",
    badgeColor: "bg-rose-50 text-rose-600 border border-rose-200",
    title: "Video to Live Quiz",
    tagline: "Turn YouTube lessons into quizzes",
    desc: "Paste any educational YouTube URL. AI extracts the core concepts, generates timed MCQs, and launches a live contest.",
    cta: "Create Quiz",
    href: "/teacher/community-quiz/new",
    highlights: ["Automatic video transcripts", "Multiplayer live contest", "Instant leaderboards"],
    isHighlight: false,
  },
  {
    icon: Grid,
    badge: "PRACTICE",
    badgeColor: "bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]",
    title: "Worksheet Studio",
    tagline: "Custom homework & drill sheets",
    desc: "Design structured practice worksheets with diagrams, step spaces, and formulas tailored to your classroom syllabus.",
    cta: "Open Studio",
    href: "/dashboard",
    highlights: ["Curriculum aligned", "Formatted for print", "Difficulty progression"],
    isHighlight: false,
  },
  {
    icon: BookOpen,
    badge: "ACTIVE RECALL",
    badgeColor: "bg-purple-50 text-purple-700 border border-purple-200",
    title: "Smart Flashcards",
    tagline: "High-retention study cards",
    desc: "Convert lengthy textbook chapters and complex formulas into active-recall digital flashcards for high-retention revision.",
    cta: "Explore Cards",
    href: "/dashboard/flashcards",
    highlights: ["Spaced repetition", "Chapter summaries", "Mobile-friendly revision"],
    isHighlight: false,
  },
  {
    icon: Search,
    badge: "EXAM BANK",
    badgeColor: "bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]",
    title: "PYQ Question Bank",
    tagline: "Past 10-year board questions",
    desc: "Search, filter, and assign verified Previous Year Questions with official marking rubrics and step-by-step solutions.",
    cta: "Browse PYQs",
    href: "/practice/zone",
    highlights: ["CBSE past 10 years", "Chapter-wise breakdown", "Marking scheme included"],
    isHighlight: false,
  },
];

const AiToolsSuite = memo(function AiToolsSuite() {
  const navigate = useNavigate();
  return (
    <section id="ai-tools" className="relative py-20 bg-gray-50 border-y border-gray-200 scroll-mt-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-[10px] px-3.5 py-1.5 text-xs font-bold bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]">
            <Sparkles className="h-3.5 w-3.5 text-[#f75961]" />
            Practical AI Tools for Indian Education
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight">
            Magical AI Tools for <span className="text-[#f75961]" style={{ color: "#f75961" }}>Modern Teachers</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-gray-600 font-medium">
            From checking handwritten answer sheets to generating curriculum-perfect test papers — everything in one unified dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {AI_TOOLS_DATA.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.title}
                className={`relative rounded-2xl p-6 sm:p-8 bg-white border flex flex-col justify-between ${
                  tool.isHighlight
                    ? "border-amber-300 shadow-md"
                    : "border-gray-200 shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div className="h-12 w-12 rounded-[14px] bg-[#fff0f1] border border-[#fecdd3] flex items-center justify-center text-[#f75961]">
                      <Icon className="h-6 w-6" />
                    </div>
                    {tool.badge && (
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-[8px] ${tool.badgeColor}`}>
                        {tool.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    {tool.title}
                  </h3>
                  <p className="text-xs font-bold text-[#f75961] mt-1 mb-3">
                    {tool.tagline}
                  </p>
                  <p className="text-sm text-gray-600 font-medium leading-relaxed mb-6">
                    {tool.desc}
                  </p>

                  <div className="space-y-2 mb-6">
                    {tool.highlights.map((h) => (
                      <div key={h} className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <Check className="h-3.5 w-3.5 text-[#f75961] shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => navigate(tool.href)}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-[14px] text-sm font-bold bg-black text-white hover:bg-neutral-800 cursor-pointer"
                  >
                    <span>{tool.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

/* ── HOW IT WORKS ── */
const HowItWorks = memo(function HowItWorks() {
  return (
    <section className="relative bg-white py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-xs font-bold bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]">
            <Sparkles className="h-3.5 w-3.5 text-[#f75961]" />3 Steps, 2 Minutes
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: txtHead }}>
            How It <span className="text-[#f75961]" style={{ color: "#f75961" }}>Works</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ color: txtMuted }}>
            Pick chapters, set marks — get a print-ready CBSE paper
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {HOW_STEPS.map(({ title, desc, Icon }, i) => (
            <div
              key={title}
              className="rounded-2xl p-6 sm:p-8 bg-white border border-gray-200 shadow-sm"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] text-sm font-bold text-white bg-black">
                  {i + 1}
                </div>
                <div className="h-px flex-1 bg-gray-200" />
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#fff0f1] border border-[#fecdd3]">
                  <Icon className="h-4 w-4" style={{ color: accentColor }} />
                </div>
              </div>
              <h3 className="mb-2 text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── UPGRADED CTA SECTION ── */
const UpgradedCTA = memo(function UpgradedCTA() {
  const { session } = useAuth();
  const navigate = useNavigate();
  return (
    <section className="relative py-16 bg-white">
      <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-2xl p-6 sm:p-10 text-center bg-white border border-gray-200 shadow-sm">
          <div className="mb-4 inline-flex items-center gap-2 rounded-[10px] px-4 py-1.5 text-xs font-bold bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]">
            <Sparkles className="h-3.5 w-3.5 text-[#f75961]" />
            2 free papers every month
          </div>
          <h3 className="mb-4 text-2xl sm:text-3xl font-bold text-gray-900">
            Create Your First Paper <span className="text-[#f75961]" style={{ color: "#f75961" }}>in Minutes</span>
          </h3>
          <p className="mb-6 text-sm sm:text-base text-gray-500 max-w-xl mx-auto">
            Pick your chapters, set difficulty and marks — get a complete CBSE-pattern paper with answer key, ready to print.
          </p>
          <div className="mb-8 flex flex-wrap justify-center gap-4">
            {["1 Lakh+ NCERT questions", "Section-wise layout", "Answer key included"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                <div className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-black text-white">
                  <Check className="h-3 w-3" />
                </div>
                {f}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate("/dashboard/test-generator")}
              className="bg-black text-white px-8 py-3.5 rounded-[14px] text-sm sm:text-base font-bold w-full sm:w-auto flex items-center justify-center gap-2 hover:bg-neutral-800 cursor-pointer"
            >
              <span>Try Free — No Login Needed</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link to={session ? "/dashboard/test-generator" : "/signup"} className="w-full sm:w-auto">
              <button className="bg-black text-white px-8 py-3.5 rounded-[14px] text-sm sm:text-base font-bold w-full flex items-center justify-center hover:bg-neutral-800 cursor-pointer">
                Sign Up Free
              </button>
            </Link>
            <Link to="/pricing" className="w-full sm:w-auto">
              <button className="bg-[#f75961] hover:bg-[#e8454d] text-white px-8 py-3.5 rounded-[14px] text-sm sm:text-base font-bold w-full flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#f75961]">
                <Crown className="h-4 w-4 text-white" />
                <span>View Pricing</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
});

/* ── TRUST & SECURITY ── */
const TrustSecurity = memo(function TrustSecurity() {
  return (
    <section className="relative py-20 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-xs font-bold bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]">
            🛡️ Built for Schools
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold md:text-5xl text-gray-900">
            Trusted by <span className="text-[#f75961]" style={{ color: "#f75961" }}>Educators</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-gray-500">
            Secure, reliable, and built specifically for Indian schools and coaching centres
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TRUST_FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl p-6 text-center bg-white border border-gray-200 shadow-sm">
              <div className="mb-4 flex h-10 w-10 mx-auto items-center justify-center rounded-[10px] bg-[#fff0f1] border border-[#fecdd3]">
                <f.Icon className="h-5 w-5 text-[#f75961]" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900">{f.title}</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── OUTCOMES STATS SECTION ── */
const Outcomes = memo(function Outcomes() {
  return (
    <section className="relative py-20 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <div className="mx-auto mb-5 h-[3px] w-12 rounded-full bg-[#f75961]" />
          <h2 className="text-3xl sm:text-4xl font-bold md:text-5xl text-gray-900">
            What You <span className="text-[#f75961]" style={{ color: "#f75961" }}>Get</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-gray-500">
            Less paper-setting busywork. More teaching time. Better test papers.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {OUTCOME_STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="mb-2 text-5xl sm:text-6xl font-extrabold text-[#f75961] md:text-7xl">{s.value}</div>
              <h3 className="mb-1 text-base sm:text-lg font-semibold text-gray-900">{s.label}</h3>
              <p className="text-xs sm:text-sm text-gray-500 px-4">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── TESTIMONIALS ── */
const Testimonials = memo(function Testimonials() {
  return (
    <section className="relative py-20 bg-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-xs font-bold bg-[#fff0f1] text-[#f75961] border border-[#fecdd3]">
            💬 Community
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold md:text-5xl text-gray-900">
            What <span className="text-[#f75961]" style={{ color: "#f75961" }}>Teachers</span> Say
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-gray-500">
            Used by teachers across CBSE schools and coaching centres.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl p-6 bg-white border border-gray-200 shadow-sm relative flex flex-col justify-between" style={{ minHeight: 180 }}>
              <TestimonialContent t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

const TestimonialContent = memo(function TestimonialContent({ t }: { t: (typeof TESTIMONIALS)[number] }) {
  return (
    <>
      <div className="absolute top-2 left-4 text-6xl font-serif leading-none text-[#f75961] opacity-20">"</div>
      <p className="relative mt-6 mb-6 text-sm leading-relaxed text-gray-600 font-medium">{t.quote}</p>
      <div className="flex items-center gap-3 mt-auto">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gray-100 border border-gray-200">
          <User className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{t.name}</p>
          <p className="text-xs font-medium text-gray-500">{t.role}</p>
        </div>
      </div>
    </>
  );
});

/* ── FINAL CTA ── */
const FinalCTA = memo(function FinalCTA() {
  const navigate = useNavigate();

  return (
    <section className="relative py-24 bg-white">
      <div className="mx-auto max-w-4xl px-5 text-center">
        <div className="mx-auto mb-5 h-[3px] w-12 rounded-full bg-[#f75961]" />
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-gray-900">
          Stop Spending
          <br className="hidden sm:block" /> Evenings on <span className="text-[#f75961]" style={{ color: "#f75961" }}>Paper-Setting</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-gray-500 leading-relaxed font-medium">
          Join teachers across India who create better test papers in minutes, not hours.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate("/dashboard/test-generator")}
            className="bg-black text-white px-10 py-4 rounded-[14px] text-sm sm:text-base font-bold w-full sm:w-auto flex items-center justify-center gap-2 hover:bg-neutral-800 cursor-pointer"
          >
            <span>Try Free — No Login Needed</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link to="/signup" className="w-full sm:w-auto">
            <button className="bg-black text-white px-10 py-4 rounded-[14px] text-sm sm:text-base font-bold w-full flex items-center justify-center hover:bg-neutral-800 cursor-pointer">
              Sign Up Free
            </button>
          </Link>
          <Link to="/pricing" className="w-full sm:w-auto">
            <button className="bg-[#f75961] hover:bg-[#e8454d] text-white px-10 py-4 rounded-[14px] text-sm sm:text-base font-bold w-full flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#f75961]">
              <Crown className="h-4 w-4 text-white" />
              <span>View Pricing</span>
            </button>
          </Link>
        </div>
        <p className="mt-4 text-xs sm:text-sm font-semibold text-gray-400">
          2 free papers every month · No credit card needed
        </p>
      </div>
    </section>
  );
});