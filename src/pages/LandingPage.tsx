import React, { lazy, Suspense, memo, useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
const OptimizedDemo = lazy(() => import(/* webpackPrefetch: true */ "@/components/OptimizedDemo"));
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Sparkles, FileText, Download, Settings, User, Crown } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/context/ThemeContext";

/* ──────────────────────────────────────────────────────────────
   BRAND GRADIENT — green → cyan → blue → purple (Tests.Ever)
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #34d399, #22d3ee, #818cf8, #c084fc, #34d399, #22d3ee, #818cf8, #c084fc)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };
// Button gradient (static diagonal)
const BTN_GRADIENT = "linear-gradient(135deg, #10b981 0%, #0ea5e9 40%, #8b5cf6 100%)";

/* ── Motion presets (whileInView reveals only — very stable API) ── */
const stackContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const stackItem = {
  hidden: { opacity: 0, y: 26, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 140, damping: 16, mass: 0.7 },
  },
};

/* ── Math helpers ── */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t); // smoothstep
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a || 1), 0, 1);
const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

/* ── Data ── */
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

/* ══════════════════════════════════════════════
   ERROR BOUNDARY — isolates a crashing child so the
   rest of the page still renders.
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
    // Logged so you can see exactly which section failed, without blanking the page.
    console.error(`[a4ai] Section "${this.props.label ?? "section"}" failed:`, err, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/* ══════════════════════════════════════════════
   GLOBAL STYLES
   ══════════════════════════════════════════════ */
const GlobalStyles = () => {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }

      .ag-card {
        border-radius: 18px;
        transition: transform 0.2s cubic-bezier(.16,1,.3,1), box-shadow 0.2s cubic-bezier(.16,1,.3,1);
        position: relative; overflow: hidden;
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      .ag-card-light {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(0,0,0,0.08);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(16,185,129,0.07), 0 2px 6px rgba(0,0,0,0.05);
      }
      @media (min-width: 640px) {
        .ag-card-light {
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 24px rgba(16,185,129,0.07), 0 2px 8px rgba(0,0,0,0.06);
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
      @media (hover: hover) {
        .ag-card:hover { transform: translateY(-3px); }
        .ag-card-light:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 12px 40px rgba(16,185,129,0.14), 0 4px 16px rgba(0,0,0,0.08); }
        .ag-card-dark:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 40px rgba(0,0,0,0.6); }
      }
      @media (hover: none) { .ag-card:active { transform: scale(0.98); } }

      @keyframes fast-gradient {
        0% { background-position: 0% center; }
        100% { background-position: -200% center; }
      }

      .nlm-text {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text; animation: fast-gradient 4s linear infinite;
      }

      .btn-grad {
        position:relative; overflow:hidden;
        background: ${BTN_GRADIENT};
        border: 1px solid rgba(255,255,255,0.18);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 8px rgba(16,185,129,0.3), 0 8px 24px rgba(139,92,246,0.18);
        color: white; font-weight:600; border-radius: 14px;
        transition: transform 0.2s, box-shadow 0.2s; -webkit-tap-highlight-color: transparent;
      }
      .btn-grad::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.25) 0%,transparent 100%); pointer-events:none;
      }
      @media (hover: hover) {
        .btn-grad:hover { transform:translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 12px rgba(16,185,129,0.4), 0 16px 40px rgba(139,92,246,0.25); }
      }
      .btn-grad:active { transform: scale(0.97); }

      .btn-glass-light {
        position:relative; overflow:hidden;
        background: rgba(235, 235, 240, 0.85);
        border: 1px solid rgba(0,0,0,0.12);
        backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 2px 8px rgba(0,0,0,0.06);
        border-radius: 14px; font-weight:600; transition: transform 0.2s; -webkit-tap-highlight-color: transparent;
      }
      .btn-glass-light::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%); pointer-events:none;
      }
      @media (hover: hover) {
        .btn-glass-light:hover { transform:translateY(-2px); box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 6px 20px rgba(0,0,0,0.11); }
      }
      .btn-glass-light:active { transform: scale(0.97); }

      .btn-glass-dark {
        position:relative; overflow:hidden;
        background: rgba(60, 60, 65, 0.7);
        border: 1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 14px rgba(0,0,0,0.35);
        border-radius: 14px; font-weight:600; transition: transform 0.2s; -webkit-tap-highlight-color: transparent;
      }
      .btn-glass-dark::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 100%); pointer-events:none;
      }
      @media (hover: hover) { .btn-glass-dark:hover { transform:translateY(-2px); } }
      .btn-glass-dark:active { transform: scale(0.97); }

      .nlm-pill {
        display:inline-flex; align-items:center; gap:5px;
        padding:4px 12px; border-radius:999px; font-size:12px; font-weight:500;
      }
      @media (min-width: 640px) { .nlm-pill { padding:5px 14px; font-size:13px; gap:6px; } }

      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(50px); }
      @media (min-width: 640px) { .sorb { filter: blur(80px); } }

      .stat-n {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text; animation: fast-gradient 4s linear infinite;
      }

      @media (hover: none) { button, a { min-height: 44px; } }

      /* Marquee */
      @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      .marquee-track { display: flex; width: max-content; animation: marquee-scroll 38s linear infinite; }
      .marquee-track:hover { animation-play-state: paused; }

      /* Scroll-driven elements (set via JS) */
      .hero-shrink { transform-origin: 50% 22%; overflow: hidden; will-change: transform, opacity; }
      .hiw-head, .hiw-card { will-change: transform, opacity; }
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  return null;
};

/* ── Helpers ── */
const card = (isDark: boolean) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
const pillStyle = (isDark: boolean): React.CSSProperties => ({
  background: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
  color: isDark ? "#34d399" : "#047857",
  border: isDark ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(16,185,129,0.16)",
});
const muted = (isDark: boolean) => (isDark ? "#5f6b7a" : "#5f6368");
const head = (isDark: boolean) => (isDark ? "#f1f5f9" : "#111111");
const accent = (isDark: boolean) => (isDark ? "#34d399" : "#047857");

/* Lazy mount */
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
      { threshold: 0.05, rootMargin: "120px 0px" }
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

/* ══════════════════════════════════════════════
   SCROLL-SHRINK HERO — exponential, no blur.
   Pure window-scroll listener + direct DOM writes
   (no framer scroll hooks → can't crash on mount).
   ══════════════════════════════════════════════ */
const ScrollShrinkHero = memo(function ScrollShrinkHero() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReduced()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const r = outer.getBoundingClientRect();
      const denom = r.height || 1;
      const p = clamp(-r.top / denom, 0, 1);
      const eIn = p * p; // ease-in → exponential shrink
      const scale = 1 - eIn * 0.62; // 1 → ~0.38
      const ty = -eIn * 64;
      const radius = eIn * 36;
      const opacity = clamp(1 - seg(p, 0.55, 1), 0, 1);
      inner.style.transform = `translate3d(0, ${ty}px, 0) scale(${scale})`;
      inner.style.opacity = String(opacity);
      inner.style.borderRadius = `${radius}px`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={outerRef} className="relative">
      {/* entrance fly-in on the MIDDLE wrapper, scroll-shrink on the INNER → no conflict */}
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.1 }}
      >
        <div ref={innerRef} className="hero-shrink">
          <LandingHero />
        </div>
      </motion.div>
    </div>
  );
});

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
        <Safe label="Hero" fallback={<LandingHero />}>
          <ScrollShrinkHero />
        </Safe>

        {/* Video demo */}
        <Safe label="OptimizedDemo">
          <Suspense fallback={<div className="h-48 sm:h-96" />}>
            <LazySection>
              <OptimizedDemo />
            </LazySection>
          </Suspense>
        </Safe>

        {/* LandingFeatures intentionally removed */}

        <Safe label="HowItWorks">
          <HowItWorks isDark={isDark} />
        </Safe>
        <Safe label="UpgradedCTA">
          <UpgradedCTA isDark={isDark} />
        </Safe>
        <Safe label="TrustSecurity">
          <TrustSecurity isDark={isDark} />
        </Safe>
        <Safe label="Outcomes">
          <Outcomes isDark={isDark} />
        </Safe>
        <Safe label="Testimonials">
          <Testimonials isDark={isDark} />
        </Safe>
        <Safe label="FinalCTA">
          <FinalCTA isDark={isDark} />
        </Safe>
      </main>
      <Footer />
    </div>
  );
}

/* ══════════════════════════════════════════════
   HOW IT WORKS — scroll-pinned reveal.
   Direct-DOM scroll (no framer scroll hooks).
   ══════════════════════════════════════════════ */
const HowItWorks = memo(function HowItWorks({ isDark }: { isDark: boolean }) {
  const [reduce, setReduce] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const card0 = useRef<HTMLDivElement>(null);
  const card1 = useRef<HTMLDivElement>(null);
  const card2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isReduced = prefersReduced();
    setReduce(isReduced);
    if (isReduced) return;

    const cards = [card0.current, card1.current, card2.current];
    const ranges: [number, number][] = [
      [0.14, 0.34],
      [0.3, 0.5],
      [0.46, 0.66],
    ];
    let raf = 0;
    const update = () => {
      raf = 0;
      const track = trackRef.current;
      if (!track) return;
      const r = track.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const denom = r.height - vh;
      const p = denom > 0 ? clamp(-r.top / denom, 0, 1) : 0;

      if (headRef.current) {
        const t = smooth(seg(p, 0, 0.12));
        headRef.current.style.opacity = String(t);
        headRef.current.style.transform = `translate3d(0, ${(1 - t) * 40}px, 0)`;
      }
      cards.forEach((el, i) => {
        if (!el) return;
        const t = smooth(seg(p, ranges[i][0], ranges[i][1]));
        el.style.opacity = String(t);
        el.style.transform = `translate3d(0, ${(1 - t) * 90}px, 0) scale(${0.9 + 0.1 * t})`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const Inner = (
    <>
      <div className="hidden sm:block">
        <div className="sorb" style={{ width: 400, height: 400, right: -80, top: -80, background: isDark ? "rgba(16,185,129,0.07)" : "rgba(16,185,129,0.05)" }} />
        <div className="sorb" style={{ width: 300, height: 300, left: -60, bottom: -40, background: isDark ? "rgba(129,140,248,0.06)" : "rgba(129,140,248,0.04)" }} />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
        <div
          ref={headRef}
          className="hiw-head mb-10 sm:mb-14 md:mb-16 text-center"
          style={reduce ? undefined : { opacity: 0, transform: "translate3d(0,40px,0)" }}
        >
          <span className="nlm-pill" style={pillStyle(isDark)}>
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />3 Steps, 2 Minutes
          </span>
          <h2 className="mt-3 sm:mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            How It <span className="nlm-text">Works</span>
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Pick chapters, set marks — get a print-ready CBSE paper
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:gap-8">
          {HOW_STEPS.map(({ title, desc, Icon }, i) => (
            <div
              key={title}
              ref={i === 0 ? card0 : i === 1 ? card1 : card2}
              className={`hiw-card ${card(isDark)} p-6 sm:p-8`}
              style={reduce ? undefined : { opacity: 0, transform: "translate3d(0,90px,0) scale(0.9)" }}
            >
              <div className="mb-4 sm:mb-5 flex items-center gap-3">
                <div
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-bold text-white"
                  style={{ background: BTN_GRADIENT }}
                >
                  {i + 1}
                </div>
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(16,185,129,0.25),transparent)" }} />
                <div
                  className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl"
                  style={{
                    background: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
                    border: isDark ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(16,185,129,0.12)",
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: accent(isDark) }} />
                </div>
              </div>
              <h3 className="mb-1.5 sm:mb-2 text-base sm:text-lg font-semibold relative z-10" style={{ color: head(isDark) }}>{title}</h3>
              <p className="text-sm leading-relaxed relative z-10" style={{ color: muted(isDark) }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (reduce) {
    return (
      <section className="relative overflow-hidden py-16 sm:py-20 md:py-24" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
        {Inner}
      </section>
    );
  }

  return (
    <section ref={trackRef} className="relative" style={{ height: "300vh", background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="sticky top-0 flex min-h-screen flex-col justify-center overflow-hidden py-16">{Inner}</div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   UPGRADED CTA
   ══════════════════════════════════════════════ */
const UpgradedCTA = memo(function UpgradedCTA({ isDark }: { isDark: boolean }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  return (
    <section className="relative py-12 sm:py-16 md:py-20" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="relative mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}>
          <motion.div variants={stackItem}>
            <div className="p-px rounded-2xl sm:rounded-3xl" style={{ background: "linear-gradient(135deg,rgba(52,211,153,0.4),rgba(34,211,238,0.35),rgba(129,140,248,0.4))" }}>
              <div
                className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 text-center relative overflow-hidden"
                style={{ background: isDark ? "rgba(10,14,24,0.9)" : "rgba(244,255,250,0.95)", backdropFilter: "blur(24px) saturate(160%)" }}
              >
                <div className="hidden sm:block">
                  <div className="sorb" style={{ width: 300, height: 300, right: -80, top: -80, background: "rgba(52,211,153,0.1)" }} />
                  <div className="sorb" style={{ width: 300, height: 300, left: -80, bottom: -80, background: "rgba(129,140,248,0.1)" }} />
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-12 sm:h-16 rounded-t-2xl sm:rounded-t-3xl"
                  style={{ background: isDark ? "linear-gradient(180deg,rgba(255,255,255,0.04) 0%,transparent 100%)" : "linear-gradient(180deg,rgba(255,255,255,0.7) 0%,transparent 100%)" }}
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
                    <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: "#10b981" }} />
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
                        <div className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full flex-shrink-0" style={{ background: BTN_GRADIENT }}>
                          <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button onClick={() => navigate("/dashboard/test-generator")} className="btn-grad w-full sm:w-auto px-6 sm:px-8 py-3 text-sm sm:text-base">
                      <span className="relative z-10 flex items-center justify-center gap-2">🚀 Try Free — No Login Needed <ArrowRight className="h-4 w-4" /></span>
                    </button>
                    <Link to={session ? "/dashboard/test-generator" : "/signup"}>
                      <button className="btn-glass-light w-full sm:w-auto px-6 sm:px-8 py-3 text-sm sm:text-base" style={{ color: "#202124" }}>
                        <span className="relative z-10 flex items-center justify-center gap-2">Sign Up Free <ArrowRight className="h-4 w-4" /></span>
                      </button>
                    </Link>
                    <Link to="/pricing">
                      <button className={`w-full sm:w-auto px-6 sm:px-8 py-3 text-sm sm:text-base ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
                        <span className="relative z-10 flex items-center justify-center gap-2"><Crown className="h-4 w-4" /> View Pricing</span>
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   TRUST & SECURITY
   ══════════════════════════════════════════════ */
const TrustSecurity = memo(function TrustSecurity({ isDark }: { isDark: boolean }) {
  return (
    <section className="relative py-16 sm:py-20 md:py-24" style={{ background: isDark ? "#050810" : "#f8fffb" }}>
      <div className="hidden sm:block sorb" style={{ width: 500, height: 350, left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: isDark ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.04)" }} />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mb-10 sm:mb-14 md:mb-16 text-center">
          <motion.span variants={stackItem} className="nlm-pill" style={{ ...pillStyle(isDark), display: "inline-flex" }}>🛡️ Built for Schools</motion.span>
          <motion.h2 variants={stackItem} className="mt-3 sm:mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            Trusted by <span className="nlm-text">Educators</span>
          </motion.h2>
          <motion.p variants={stackItem} className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Secure, reliable, and built specifically for Indian schools and coaching centres
          </motion.p>
        </motion.div>
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {TRUST_FEATURES.map((f) => (
            <motion.div key={f.title} variants={stackItem} className={`${card(isDark)} p-5 sm:p-7 text-center`}>
              <div className="mb-2 sm:mb-3 text-2xl sm:text-3xl relative z-10">{f.icon}</div>
              <h3 className="mb-1 sm:mb-2 text-sm sm:text-base font-semibold relative z-10" style={{ color: head(isDark) }}>{f.title}</h3>
              <p className="text-xs sm:text-sm leading-relaxed relative z-10" style={{ color: muted(isDark) }}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   OUTCOMES
   ══════════════════════════════════════════════ */
const Outcomes = memo(function Outcomes({ isDark }: { isDark: boolean }) {
  return (
    <section className="relative py-16 sm:py-20 md:py-24" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="hidden sm:block sorb" style={{ width: 400, height: 250, left: "50%", bottom: -40, transform: "translateX(-50%)", background: isDark ? "rgba(129,140,248,0.06)" : "rgba(129,140,248,0.04)" }} />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mb-10 sm:mb-14 md:mb-16 text-center">
          <motion.div variants={stackItem} className="mx-auto mb-4 sm:mb-5 h-[3px] w-10 sm:w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <motion.h2 variants={stackItem} className="text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            What You <span className="nlm-text">Get</span>
          </motion.h2>
          <motion.p variants={stackItem} className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Less paper-setting busywork. More teaching time. Better test papers.
          </motion.p>
        </motion.div>
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
          {OUTCOME_STATS.map((s) => (
            <motion.div key={s.label} variants={stackItem} className="text-center">
              <div className="mb-1.5 sm:mb-2 text-5xl sm:text-6xl font-extrabold stat-n md:text-7xl">{s.value}</div>
              <h3 className="mb-1 text-base sm:text-lg font-semibold" style={{ color: head(isDark) }}>{s.label}</h3>
              <p className="text-xs sm:text-sm" style={{ color: muted(isDark) }}>{s.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   TESTIMONIALS — infinite marquee
   ══════════════════════════════════════════════ */
const Testimonials = memo(function Testimonials({ isDark }: { isDark: boolean }) {
  const loop = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];
  return (
    <section className="relative py-16 sm:py-20 md:py-24 overflow-hidden" style={{ background: isDark ? "#050810" : "#f8fffb" }}>
      <div className="hidden sm:block sorb" style={{ width: 400, height: 400, right: -80, top: "15%", background: isDark ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.04)" }} />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mb-10 sm:mb-14 md:mb-16 text-center">
          <motion.span variants={stackItem} className="nlm-pill" style={{ ...pillStyle(isDark), display: "inline-flex" }}>💬 Community</motion.span>
          <motion.h2 variants={stackItem} className="mt-3 sm:mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            What <span className="nlm-text">Teachers</span> Say
          </motion.h2>
          <motion.p variants={stackItem} className="mx-auto mt-3 sm:mt-4 max-w-xl text-base sm:text-lg" style={{ color: muted(isDark) }}>
            Used by teachers across CBSE schools and coaching centres.
          </motion.p>
        </motion.div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-24 z-10" style={{ background: isDark ? "linear-gradient(90deg, #050810, transparent)" : "linear-gradient(90deg, #f8fffb, transparent)" }} />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-24 z-10" style={{ background: isDark ? "linear-gradient(270deg, #050810, transparent)" : "linear-gradient(270deg, #f8fffb, transparent)" }} />
        <div className="marquee-track">
          {loop.map((t, i) => (
            <div key={`${t.name}-${i}`} className={`${card(isDark)} p-6 sm:p-7 relative flex-shrink-0 mx-2.5 sm:mx-3`} style={{ width: 340, minHeight: 180 }}>
              <TestimonialContent t={t} isDark={isDark} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

const TestimonialContent = memo(function TestimonialContent({ t, isDark }: { t: (typeof TESTIMONIALS)[number]; isDark: boolean }) {
  return (
    <>
      <div className="absolute top-3 left-4 sm:top-4 sm:left-5 text-5xl sm:text-6xl font-serif leading-none" style={{ color: "#10b981", opacity: 0.14 }}>"</div>
      <p className="relative mt-5 sm:mt-6 mb-5 sm:mb-6 text-sm leading-relaxed z-10" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>{t.quote}</p>
      <div className="flex items-center gap-2.5 sm:gap-3 relative z-10">
        <div
          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full flex-shrink-0"
          style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)" }}
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
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden py-20 sm:py-24 md:py-28" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="hidden sm:block sorb" style={{ width: 600, height: 350, left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: isDark ? "rgba(52,211,153,0.07)" : "rgba(52,211,153,0.05)" }} />
      <div className="relative mx-auto max-w-4xl px-5 sm:px-6 text-center">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={stackItem} className="mx-auto mb-4 sm:mb-5 h-[3px] w-10 sm:w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <motion.h2 variants={stackItem} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight" style={{ color: head(isDark) }}>
            Stop Spending
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            Evenings on <span className="nlm-text">Paper-Setting</span>
          </motion.h2>
          <motion.p variants={stackItem} className="mx-auto mt-4 sm:mt-6 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: muted(isDark) }}>
            Join teachers across India who create better test papers in minutes, not hours.
          </motion.p>
          <motion.div variants={stackItem} className="mt-8 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4 sm:flex-row sm:justify-center">
            <button onClick={() => navigate("/dashboard/test-generator")} className="btn-grad w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base">
              <span className="relative z-10 flex items-center justify-center gap-2">🚀 Try Free — No Login Needed <ArrowRight className="h-4 w-4" /></span>
            </button>
            <Link to="/signup" className="w-full sm:w-auto">
              <button className="btn-glass-light w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base" style={{ color: "#202124" }}>
                <span className="relative z-10 flex items-center justify-center gap-2">Sign Up Free <ArrowRight className="h-4 w-4" /></span>
              </button>
            </Link>
            <Link to="/pricing" className="w-full sm:w-auto">
              <button className={`w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
                <span className="relative z-10 flex items-center justify-center gap-2"><Crown className="h-4 w-4" /> View Pricing</span>
              </button>
            </Link>
          </motion.div>
          <motion.p variants={stackItem} className="mt-3 sm:mt-4 text-xs sm:text-sm" style={{ color: muted(isDark) }}>
            2 free papers every month · No credit card needed
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
});