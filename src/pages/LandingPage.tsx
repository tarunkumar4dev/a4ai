import React, { lazy, Suspense, memo, useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
const OptimizedDemo = lazy(() => import(/* webpackPrefetch: true */ "@/components/OptimizedDemo"));
const LandingFeatures = lazy(() => import(/* webpackPrefetch: true */ "@/components/LandingFeatures"));
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import { LazyMotion, domAnimation } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, FileText, Download, Settings, User, Crown } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/context/ThemeContext";

// New Brand Gradient: Green -> Teal -> Blue -> Purple
const BRAND_GRADIENT = "linear-gradient(90deg, #4ade80, #2dd4bf, #60a5fa, #818cf8, #4ade80, #2dd4bf, #60a5fa, #818cf8)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

const HOW_STEPS = Object.freeze([
  { title: "Set Your Paper", desc: "Pick subject, class, chapters, marks distribution, and question types.", Icon: Settings },
  { title: "Generate from NCERT", desc: "Questions are pulled directly from NCERT content — chapter-accurate, Bloom's-tagged.", Icon: FileText },
  { title: "Download & Print", desc: "Get a CBSE-pattern PDF or DOCX with sections, marks, and answer key.", Icon: Download },
]);
const TRUST_FEATURES = Object.freeze([
  { title: "Encryption", desc: "Data encrypted in transit and at rest with modern standards.", icon: "🔒" },
  { title: "Privacy-First", desc: "No ads, no selling data. You control retention and export.", icon: "🛡️" },
  { title: "Reliability", desc: "Monitored uptime and graceful fallbacks during peak load.", icon: "⚡" },
  { title: "Controls", desc: "Role-based access, per-class sharing, and one-click export.", icon: "⚙️" },
]);
const OUTCOME_STATS = Object.freeze([
  { value: "6+", label: "Question Formats", description: "MCQ, Short, Long, A&R, Cloze…" },
  { value: "PDF & Word", label: "Export Options", description: "Print-ready or share digitally" },
  { value: "<2 min", label: "Per Paper", description: "Full CBSE-pattern test paper" },
]);
const TESTIMONIALS = Object.freeze([
  { quote: "a4ai has saved me hours every week. The questions actually match what's in the NCERT textbook — no random internet stuff.", name: "Rahul Verma", role: "Director, Education Beast" },
  { quote: "Perfect for creating differentiated assessments. I set chapters and difficulty, and the paper comes out section-wise ready to print.", name: "Abhay Gupta", role: "Director, Chanakya Institute" },
  { quote: "Surprised by the accuracy. Questions come straight from NCERT content with proper Bloom's levels. Saves me 3-4 hours per week.", name: "Aman Singh", role: "Chemistry Teacher (10+ Years Exp)" },
]);

/* ── Global styles ── */
const GlobalStyles = () => {
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }

      /* Reduced motion global */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* GPU-promote animated elements */
      .will-gpu { will-change: transform, opacity; }

      /* Scroll reveal */
      .rv { opacity:0; transform:translateY(16px); transition:opacity 0.45s cubic-bezier(.16,1,.3,1),transform 0.45s cubic-bezier(.16,1,.3,1); }
      .rv.in { opacity:1; transform:translateY(0); }

      /* Apple glass card */
      .ag-card {
        border-radius: 18px;
        transition: transform 0.2s cubic-bezier(.16,1,.3,1), box-shadow 0.2s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
      }
      @media (min-width: 640px) {
        .ag-card { border-radius: 20px; }
      }
      .ag-card-light {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(0,0,0,0.08);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(66,133,244,0.06), 0 2px 6px rgba(0,0,0,0.05);
      }
      @media (min-width: 640px) {
        .ag-card-light {
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 24px rgba(66,133,244,0.06), 0 2px 8px rgba(0,0,0,0.06);
        }
      }
      .ag-card-light::before {
        content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
        background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 40%);
      }
      .ag-card-dark {
        background: rgba(20,25,40,0.65);
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 6px 24px rgba(0,0,0,0.45);
      }
      @media (min-width: 640px) {
        .ag-card-dark {
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.5);
        }
      }
      .ag-card-dark::before {
        content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
        background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 45%);
      }

      /* Hover only on non-touch */
      @media (hover: hover) {
        .ag-card:hover { transform: translateY(-3px); }
        .ag-card-light:hover {
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 12px 40px rgba(66,133,244,0.12), 0 4px 16px rgba(0,0,0,0.08);
        }
        .ag-card-dark:hover {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 40px rgba(0,0,0,0.6);
        }
      }
      /* Touch active state */
      @media (hover: none) {
        .ag-card:active { transform: scale(0.98); }
      }

      /* Fast Gradient animation */
      @keyframes fast-gradient { 
        0% { background-position: 0% center; } 
        100% { background-position: -200% center; } 
      }

      /* Gradient text */
      .nlm-text {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }

      /* Black glossy button */
      .btn-blk {
        position:relative; overflow:hidden;
        background: linear-gradient(180deg,#202124 0%,#111111 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2);
        color: white; font-weight:600;
        border-radius: 14px;
        transition: transform 0.2s, box-shadow 0.2s;
        -webkit-tap-highlight-color: transparent;
      }
      .btn-blk::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.16) 0%,transparent 100%);
        pointer-events:none;
      }
      @media (hover: hover) {
        .btn-blk:hover { transform:translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -1px 0 rgba(0,0,0,0.3),0 4px 10px rgba(0,0,0,0.4),0 16px 40px rgba(0,0,0,0.3); }
      }
      .btn-blk:active { transform: scale(0.97); }

      /* Glass Button - Light */
      .btn-glass-light {
        position:relative; overflow:hidden;
        background: rgba(235, 235, 240, 0.85);
        border: 1px solid rgba(0,0,0,0.12);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 2px 8px rgba(0,0,0,0.06);
        border-radius: 14px; font-weight:600;
        transition: transform 0.2s;
        -webkit-tap-highlight-color: transparent;
      }
      .btn-glass-light::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%);
        pointer-events:none;
      }
      @media (hover: hover) {
        .btn-glass-light:hover { transform:translateY(-2px); box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 6px 20px rgba(0,0,0,0.11); }
      }
      .btn-glass-light:active { transform: scale(0.97); }

      /* Glass Button - Dark */
      .btn-glass-dark {
        position:relative; overflow:hidden;
        background: rgba(60, 60, 65, 0.7);
        border: 1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 14px rgba(0,0,0,0.35);
        border-radius: 14px; font-weight:600;
        transition: transform 0.2s;
        -webkit-tap-highlight-color: transparent;
      }
      .btn-glass-dark::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 100%);
        pointer-events:none;
      }
      @media (hover: hover) {
        .btn-glass-dark:hover { transform:translateY(-2px); }
      }
      .btn-glass-dark:active { transform: scale(0.97); }

      /* Pill */
      .nlm-pill {
        display:inline-flex; align-items:center; gap:5px;
        padding:4px 12px; border-radius:999px; font-size:12px; font-weight:500;
      }
      @media (min-width: 640px) {
        .nlm-pill { padding:5px 14px; font-size:13px; gap:6px; }
      }

      /* Section orb — lighter blur on mobile */
      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(50px); }
      @media (min-width: 640px) {
        .sorb { filter: blur(80px); }
      }

      /* Stat shimmer */
      .stat-n {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text; 
        -webkit-text-fill-color: transparent; 
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }

      /* Touch-friendly tap targets */
      @media (hover: none) {
        button, a { min-height: 44px; }
      }
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  return null;
};

/* ── Shared hooks ── */
const useReveal = (delay = 0) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => {
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            el.classList.add("in");
            obs.unobserve(el);
          }
        },
        { threshold: 0.08, rootMargin: "20px 0px" }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
};

const useInView = () => {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.unobserve(ref);
        }
      },
      { threshold: 0.05, rootMargin: "80px 0px" }
    );
    obs.observe(ref);
    return () => obs.disconnect();
  }, [ref]);
  return [setRef, inView] as const;
};

const LazySection = memo(({ children }: { children: React.ReactNode }) => {
  const [setRef, inView] = useInView();
  return <div ref={setRef}>{inView && children}</div>;
});

/* ── Helpers ── */
const card = (isDark: boolean) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
const pillProps = (isDark: boolean) => ({
  className: "nlm-pill",
  style: {
    background: isDark ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.07)",
    color: isDark ? "#4ade80" : "#059669",
    border: isDark ? "1px solid rgba(74,222,128,0.18)" : "1px solid rgba(74,222,128,0.12)",
  },
});
const muted = (isDark: boolean) => (isDark ? "#5f6b7a" : "#5f6368");
const head = (isDark: boolean) => (isDark ? "#f1f5f9" : "#111111");

/* ══════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════ */
export default function LandingPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className="lp flex min-h-screen flex-col" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <GlobalStyles />
      <Navbar />
      <main className="flex-grow">
        <LandingHero />
        <Suspense fallback={<div className="h-48 sm:h-96" />}>
          <LazySection><OptimizedDemo /></LazySection>
        </Suspense>
        <Suspense fallback={<div className="h-48 sm:h-96" />}>
          <LazySection><LandingFeatures /></LazySection>
        </Suspense>
        <LazyMotion features={domAnimation} strict>
          <HowItWorks isDark={isDark} />
          <TrustSecurity isDark={isDark} />
          <Outcomes isDark={isDark} />
          <Testimonials isDark={isDark} />
          <FinalCTA isDark={isDark} />
        </LazyMotion>
      </main>
      <Footer />
    </div>
  );
}

/* ══════════════════════════════════════════════
   HOW IT WORKS
   ══════════════════════════════════════════════ */
const HowItWorks = memo(function HowItWorks({ isDark }: { isDark: boolean }) {
  const tr = useReveal();
  const sr = [useReveal(60), useReveal(120), useReveal(180)];
  return (
    <section className="relative overflow-hidden py-16 sm:py-20 md:py-24" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      {/* Orbs — hidden on mobile */}
      <div className="hidden sm:block">
        <div className="sorb" style={{ width: 400, height: 400, right: -80, top: -80, background: isDark ? "rgba(45,212,191,0.06)" : "rgba(45,212,191,0.04)" }} />
        <div className="sorb" style={{ width: 300, height: 300, left: -60, bottom: -40, background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-10 sm:mb-14 md:mb-16 text-center">
          <span {...pillProps(isDark)}><Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />3 Steps, 2 Minutes</span>
          <h2 className="mt-3 sm:mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            How It <span className="nlm-text">Works</span>
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Pick chapters, set marks — get a print-ready CBSE paper
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:gap-8">
          {HOW_STEPS.map(({ title, desc, Icon }, i) => (
            <div key={title} ref={sr[i]} className={`rv ${card(isDark)} p-6 sm:p-8`}>
              <div className="mb-4 sm:mb-5 flex items-center gap-3">
                <div
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-bold text-white"
                  style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}
                >
                  {i + 1}
                </div>
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(45,212,191,0.2),transparent)" }} />
                <div
                  className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl"
                  style={{
                    background: isDark ? "rgba(45,212,191,0.1)" : "rgba(45,212,191,0.07)",
                    border: isDark ? "1px solid rgba(45,212,191,0.15)" : "1px solid rgba(45,212,191,0.1)",
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: isDark ? "#2dd4bf" : "#0d9488" }} />
                </div>
              </div>
              <h3 className="mb-1.5 sm:mb-2 text-base sm:text-lg font-semibold relative z-10" style={{ color: head(isDark) }}>{title}</h3>
              <p className="text-sm leading-relaxed relative z-10" style={{ color: muted(isDark) }}>{desc}</p>
            </div>
          ))}
        </div>

        <UpgradedCTA isDark={isDark} />
      </div>
    </section>
  );
});

/* ── Upgraded CTA ── */
const UpgradedCTA = memo(function UpgradedCTA({ isDark }: { isDark: boolean }) {
  const { session } = useAuth();
  const ref = useReveal();
  return (
    <div ref={ref} className="rv mx-auto mt-14 sm:mt-16 md:mt-20 max-w-4xl">
      <div className="p-px rounded-2xl sm:rounded-3xl" style={{ background: "linear-gradient(135deg,rgba(74,222,128,0.35),rgba(129,140,248,0.35))" }}>
        <div
          className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 text-center relative overflow-hidden"
          style={{
            background: isDark ? "rgba(10,14,24,0.9)" : "rgba(248,252,255,0.95)",
            backdropFilter: "blur(24px) saturate(160%)",
          }}
        >
          {/* Orbs — simplified on mobile */}
          <div className="hidden sm:block">
            <div className="sorb" style={{ width: 300, height: 300, right: -80, top: -80, background: "rgba(74,222,128,0.08)" }} />
            <div className="sorb" style={{ width: 300, height: 300, left: -80, bottom: -80, background: "rgba(129,140,248,0.08)" }} />
          </div>

          {/* Top sheen */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-12 sm:h-16 rounded-t-2xl sm:rounded-t-3xl"
            style={{
              background: isDark
                ? "linear-gradient(180deg,rgba(255,255,255,0.04) 0%,transparent 100%)"
                : "linear-gradient(180deg,rgba(255,255,255,0.7) 0%,transparent 100%)",
            }}
          />

          <div className="relative z-10">
            <div
              className="mb-3 sm:mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium"
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.07)",
                backdropFilter: "blur(16px)",
                color: isDark ? "#8a9bb0" : "#5f6368",
              }}
            >
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: "#2dd4bf" }} />
              2 free papers every month
            </div>

            <h3 className="mb-3 sm:mb-4 text-2xl sm:text-3xl font-bold" style={{ color: head(isDark) }}>
              Create Your First Paper <span className="nlm-text">in Minutes</span>
            </h3>

            <p className="mb-5 sm:mb-7 text-sm sm:text-base leading-relaxed" style={{ color: muted(isDark) }}>
              Pick your chapters, set difficulty and marks — get a complete CBSE-pattern paper with answer key, ready to print.
            </p>

            <div className="mb-5 sm:mb-7 flex flex-wrap justify-center gap-3 sm:gap-5">
              {["NCERT content only", "Section-wise layout", "Answer key included"].map((f) => (
                <div key={f} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>
                  <div
                    className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full flex-shrink-0"
                    style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}
                  >
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                  </div>
                  {f}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to={session ? "/dashboard/test-generator" : "/signup"}>
                <button className="btn-blk w-full sm:w-auto px-6 sm:px-8 py-3 text-sm sm:text-base">
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Try for FREE <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </Link>
              <Link to="/pricing">
                <button
                  className={`w-full sm:w-auto px-6 sm:px-8 py-3 text-sm sm:text-base ${isDark ? "btn-glass-dark" : "btn-glass-light"}`}
                  style={{ color: isDark ? "#e8eaed" : "#202124" }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Crown className="h-4 w-4" /> View Pricing
                  </span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════
   TRUST & SECURITY
   ══════════════════════════════════════════════ */
const TrustSecurity = memo(function TrustSecurity({ isDark }: { isDark: boolean }) {
  const tr = useReveal();
  const cr = [useReveal(60), useReveal(100), useReveal(140), useReveal(180)];
  return (
    <section className="relative py-16 sm:py-20 md:py-24" style={{ background: isDark ? "#050810" : "#f8fafe" }}>
      <div className="hidden sm:block sorb" style={{ width: 500, height: 350, left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: isDark ? "rgba(96,165,250,0.04)" : "rgba(96,165,250,0.03)" }} />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-10 sm:mb-14 md:mb-16 text-center">
          <span {...pillProps(isDark)}>🛡️ Built for Schools</span>
          <h2 className="mt-3 sm:mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            Trusted by <span className="nlm-text">Educators</span>
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Secure, reliable, and built specifically for Indian schools and coaching centres
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {TRUST_FEATURES.map((f, i) => (
            <div key={f.title} ref={cr[i]} className={`rv ${card(isDark)} p-5 sm:p-7 text-center`}>
              <div className="mb-2 sm:mb-3 text-2xl sm:text-3xl relative z-10">{f.icon}</div>
              <h3 className="mb-1 sm:mb-2 text-sm sm:text-base font-semibold relative z-10" style={{ color: head(isDark) }}>{f.title}</h3>
              <p className="text-xs sm:text-sm leading-relaxed relative z-10" style={{ color: muted(isDark) }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   OUTCOMES
   ══════════════════════════════════════════════ */
const Outcomes = memo(function Outcomes({ isDark }: { isDark: boolean }) {
  const tr = useReveal();
  const sr = [useReveal(60), useReveal(120), useReveal(180)];
  return (
    <section className="relative py-16 sm:py-20 md:py-24" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="hidden sm:block sorb" style={{ width: 400, height: 250, left: "50%", bottom: -40, transform: "translateX(-50%)", background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)" }} />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-10 sm:mb-14 md:mb-16 text-center">
          <div className="mx-auto mb-4 sm:mb-5 h-[3px] w-10 sm:w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <h2 className="text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            What You <span className="nlm-text">Get</span>
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Less paper-setting busywork. More teaching time. Better test papers.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
          {OUTCOME_STATS.map((s, i) => (
            <div key={s.label} ref={sr[i]} className="rv text-center">
              <div className="mb-1.5 sm:mb-2 text-5xl sm:text-6xl font-extrabold stat-n md:text-7xl">{s.value}</div>
              <h3 className="mb-1 text-base sm:text-lg font-semibold" style={{ color: head(isDark) }}>{s.label}</h3>
              <p className="text-xs sm:text-sm" style={{ color: muted(isDark) }}>{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   TESTIMONIALS
   ══════════════════════════════════════════════ */
const Testimonials = memo(function Testimonials({ isDark }: { isDark: boolean }) {
  const tr = useReveal();
  const cr = [useReveal(60), useReveal(120), useReveal(180)];

  /* Mobile horizontal scroll ref */
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="relative py-16 sm:py-20 md:py-24" style={{ background: isDark ? "#050810" : "#f8fafe" }}>
      <div className="hidden sm:block sorb" style={{ width: 400, height: 400, right: -80, top: "15%", background: isDark ? "rgba(45,212,191,0.05)" : "rgba(45,212,191,0.03)" }} />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-10 sm:mb-14 md:mb-16 text-center">
          <span {...pillProps(isDark)}>💬 Community</span>
          <h2 className="mt-3 sm:mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            What <span className="nlm-text">Teachers</span> Say
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Used by teachers across CBSE schools and coaching centres.
          </p>
        </div>

        {/* Desktop: grid | Mobile: horizontal scroll */}
        {/* Desktop grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} ref={cr[i]} className={`rv ${card(isDark)} p-8 relative`}>
              <TestimonialContent t={t} isDark={isDark} />
            </div>
          ))}
        </div>

        {/* Mobile horizontal scroll */}
        <div
          ref={scrollRef}
          className="md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-5 px-5"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className={`${card(isDark)} p-6 relative flex-shrink-0 snap-center`}
              style={{ width: "calc(85vw - 20px)", maxWidth: 340 }}
            >
              <TestimonialContent t={t} isDark={isDark} />
            </div>
          ))}
        </div>

        {/* Scroll dots for mobile */}
        <div className="md:hidden flex justify-center gap-1.5 mt-4">
          {TESTIMONIALS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }}
            />
          ))}
        </div>
      </div>
    </section>
  );
});

const TestimonialContent = memo(function TestimonialContent({
  t,
  isDark,
}: {
  t: (typeof TESTIMONIALS)[number];
  isDark: boolean;
}) {
  return (
    <>
      <div
        className="absolute top-3 left-4 sm:top-4 sm:left-5 text-5xl sm:text-6xl font-serif leading-none"
        style={{ color: "#2dd4bf", opacity: 0.12 }}
      >
        "
      </div>
      <p
        className="relative mt-5 sm:mt-6 mb-5 sm:mb-6 text-sm leading-relaxed z-10"
        style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}
      >
        {t.quote}
      </p>
      <div className="flex items-center gap-2.5 sm:gap-3 relative z-10">
        <div
          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full flex-shrink-0"
          style={{
            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <User className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: isDark ? "#c8d4e0" : "#5f6368" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: head(isDark) }}>{t.name}</p>
          <p className="text-xs" style={{ color: muted(isDark) }}>{t.role}</p>
        </div>
      </div>
    </>
  );
});

/* ══════════════════════════════════════════════
   FINAL CTA
   ══════════════════════════════════════════════ */
const FinalCTA = memo(function FinalCTA({ isDark }: { isDark: boolean }) {
  const ref = useReveal();
  return (
    <section className="relative overflow-hidden py-20 sm:py-24 md:py-28" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="hidden sm:block sorb" style={{ width: 600, height: 350, left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.04)" }} />

      <div className="relative mx-auto max-w-4xl px-5 sm:px-6 text-center">
        <div ref={ref} className="rv">
          <div className="mx-auto mb-4 sm:mb-5 h-[3px] w-10 sm:w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
            style={{ color: head(isDark) }}
          >
            Stop Spending
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            Evenings on <span className="nlm-text">Paper-Setting</span>
          </h2>
          <p className="mx-auto mt-4 sm:mt-6 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: muted(isDark) }}>
            Join teachers across India who create better test papers in minutes, not hours.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4 sm:flex-row sm:justify-center">
            <Link to="/signup" className="w-full sm:w-auto">
              <button className="btn-blk w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Try for FREE <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            </Link>
            <Link to="/pricing" className="w-full sm:w-auto">
              <button
                className={`w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base ${isDark ? "btn-glass-dark" : "btn-glass-light"}`}
                style={{ color: isDark ? "#e8eaed" : "#202124" }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Crown className="h-4 w-4" /> View Pricing
                </span>
              </button>
            </Link>
          </div>

          <p className="mt-3 sm:mt-4 text-xs sm:text-sm" style={{ color: muted(isDark) }}>
            2 free papers every month · No credit card needed
          </p>
        </div>
      </div>
    </section>
  );
});