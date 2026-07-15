import React, { lazy, Suspense, memo, useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
const OptimizedDemo = lazy(() => import(/* webpackPrefetch: true */ "@/components/OptimizedDemo"));
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Sparkles, FileText, Download, Settings, User, Crown } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

/* ──────────────────────────────────────────────────────────────
   BRAND GRADIENT — green → cyan → blue → purple (Tests.Ever)
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #34d399, #22d3ee, #818cf8, #c084fc, #34d399, #22d3ee, #818cf8, #c084fc)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };
const BTN_GRADIENT = "linear-gradient(135deg, #10b981 0%, #0ea5e9 40%, #8b5cf6 100%)";

/* ── Motion presets ── */
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
const smooth = (t: number) => t * t * (3 - 2 * t);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a || 1), 0, 1);

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

/* ══════════════════════════════════════════════
   GLOBAL LIGHT ENGINE STYLES
   ══════════════════════════════════════════════ */
const GlobalStyles = () => {
  useEffect(() => {
    document.documentElement.style.background = "#ffffff";
    document.documentElement.style.backgroundColor = "#ffffff";
    document.documentElement.style.colorScheme = "light";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; background-color: #ffffff !important; }
      
      html, body, #root, main, section { background: #ffffff !important; background-color: #ffffff !important; }

      .ag-card {
        border-radius: 18px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative; overflow: hidden;
        background: rgba(255, 255, 255, 0.8) !important;
        border: 1px solid rgba(0, 0, 0, 0.07) !important;
        backdrop-filter: blur(30px) saturate(170%);
        -webkit-backdrop-filter: blur(30px) saturate(170%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(16,185,129,0.03), 0 2px 6px rgba(0,0,0,0.02);
      }
      @media (min-width: 640px) { 
        .ag-card { 
          border-radius: 20px; 
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 6px 24px rgba(16,185,129,0.04), 0 2px 8px rgba(0,0,0,0.03);
        } 
      }
      .ag-card::before {
        content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
        background: linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 40%);
      }
      @media (hover: hover) {
        .ag-card:hover { 
          transform: translateY(-4px); 
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 14px 38px rgba(16,185,129,0.09), 0 6px 16px rgba(0,0,0,0.04);
        }
      }

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
        border: 1px solid rgba(255,255,255,0.25);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(16,185,129,0.2), 0 8px 24px rgba(139,92,246,0.12);
        color: white !important; font-weight:600; border-radius: 14px;
        transition: transform 0.2s, box-shadow 0.2s; -webkit-tap-highlight-color: transparent;
      }
      .btn-grad::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.3) 0%,transparent 100%); pointer-events:none;
      }
      @media (hover: hover) {
        .btn-grad:hover { transform:translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 14px rgba(16,185,129,0.35), 0 16px 40px rgba(139,92,246,0.2); }
      }
      .btn-grad:active { transform: scale(0.97); }

      .btn-glass-light {
        position:relative; overflow:hidden;
        background: rgba(240, 240, 245, 0.8);
        border: 1px solid rgba(0,0,0,0.08);
        backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 2px 8px rgba(0,0,0,0.04);
        border-radius: 14px; font-weight:600; transition: transform 0.2s; color: #1f2937 !important;
      }
      @media (hover: hover) {
        .btn-glass-light:hover { transform:translateY(-2px); box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 6px 20px rgba(0,0,0,0.08); }
      }

      .nlm-pill {
        display:inline-flex; align-items:center; gap:5px;
        padding:5px 14px; border-radius:999px; font-size:13px; font-weight:500;
        background: rgba(16,185,129,0.06); color: #047857; border: 1px solid rgba(16,185,129,0.14);
      }

      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(70px); }
      @media (min-width: 640px) { .sorb { filter: blur(100px); } }

      .stat-n {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text; animation: fast-gradient 4s linear infinite;
      }

      @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      .marquee-track { display: flex; width: max-content; animation: marquee-scroll 38s linear infinite; }
      .marquee-track:hover { animation-play-state: paused; }

      .hero-shrink { transform-origin: 50% 22%; overflow: hidden; will-change: transform, opacity; background: #ffffff !important; }
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  return null;
};

const txtMuted = "#5f6368";
const txtHead = "#111111";
const accentColor = "#047857";

const useInView = () => {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true);
        obs.unobserve(ref);
      }
    }, { threshold: 0.01, rootMargin: "200px 0px" });
    obs.observe(ref);
    return () => obs.disconnect();
  }, [ref]);
  return [setRef, inView] as const;
};

const LazySection = memo(({ children }: { children: React.ReactNode }) => {
  const [setRef, inView] = useInView();
  return <div ref={setRef} className="bg-white">{inView ? children : <div className="h-48 bg-white" />}</div>;
});

/* ══════════════════════════════════════════════
   SCROLL-SHRINK HERO
   ══════════════════════════════════════════════ */
const ScrollShrinkHero = memo(function ScrollShrinkHero() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const r = outer.getBoundingClientRect();
      const denom = r.height || 1;
      const p = clamp(-r.top / denom, 0, 1);
      const eIn = p * p; 
      const scale = 1 - eIn * 0.62; 
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
    <div ref={outerRef} className="relative bg-white">
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.1 }}
      >
        <div ref={innerRef} className="hero-shrink bg-white">
          <LandingHero />
        </div>
      </motion.div>
    </div>
  );
});

export default function LandingPage() {
  return (
    <div className="lp flex min-h-screen flex-col bg-white">
      <GlobalStyles />
      <Navbar />
      <main className="flex-grow bg-white">
        <Safe label="Hero" fallback={<LandingHero />}>
          <ScrollShrinkHero />
        </Safe>

        <Safe label="OptimizedDemo">
          <Suspense fallback={<div className="h-48 sm:h-96 bg-white" />}>
            <LazySection>
              <OptimizedDemo />
            </LazySection>
          </Suspense>
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

/* ══════════════════════════════════════════════
   HOW IT WORKS
   ══════════════════════════════════════════════ */
const HowItWorks = memo(function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const card0 = useRef<HTMLDivElement>(null);
  const card1 = useRef<HTMLDivElement>(null);
  const card2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = [card0.current, card1.current, card2.current];
    const ranges: [number, number][] = [[0.14, 0.34], [0.3, 0.5], [0.46, 0.66]];
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

  return (
    <section ref={trackRef} className="relative bg-white" style={{ height: "240vh" }}>
      <div className="sticky top-0 flex min-h-screen flex-col justify-center overflow-hidden py-16 bg-white">
        <div className="hidden sm:block">
          <div className="sorb" style={{ width: 400, height: 400, right: -80, top: -80, background: "rgba(16,185,129,0.04)" }} />
          <div className="sorb" style={{ width: 300, height: 300, left: -60, bottom: -40, background: "rgba(129,140,248,0.03)" }} />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
          <div ref={headRef} className="hiw-head mb-10 text-center" style={{ opacity: 0, transform: "translate3d(0,40px,0)" }}>
            <span className="nlm-pill"><Sparkles className="h-3.5 w-3.5" />3 Steps, 2 Minutes</span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold md:text-5xl" style={{ color: txtHead }}>
              How It <span className="nlm-text">Works</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ color: txtMuted }}>
              Pick chapters, set marks — get a print-ready CBSE paper
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {HOW_STEPS.map(({ title, desc, Icon }, i) => (
              <div
                key={title}
                ref={i === 0 ? card0 : i === 1 ? card1 : card2}
                className="hiw-card ag-card p-6 sm:p-8 bg-white"
                style={{ opacity: 0, transform: "translate3d(0,90px,0) scale(0.9)" }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: BTN_GRADIENT }}>
                    {i + 1}
                  </div>
                  <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(16,185,129,0.2),transparent)" }} />
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                    <Icon className="h-4 w-4" style={{ color: accentColor }} />
                  </div>
                </div>
                <h3 className="mb-2 text-base sm:text-lg font-semibold text-neutral-900">{title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   UPGRADED CTA SECTION
   ══════════════════════════════════════════════ */
const UpgradedCTA = memo(function UpgradedCTA() {
  const { session } = useAuth();
  const navigate = useNavigate();
  return (
    <section className="relative py-16 bg-white">
      <div className="relative mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}>
          <motion.div variants={stackItem}>
            <div className="p-px rounded-3xl" style={{ background: "linear-gradient(135deg,rgba(52,211,153,0.25),rgba(34,211,238,0.2),rgba(129,140,248,0.25))" }}>
              <div className="rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden bg-white shadow-sm">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-neutral-50 to-transparent" />
                <div className="relative z-10">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    2 free papers every month
                  </div>
                  <h3 className="mb-4 text-2xl sm:text-3xl font-bold text-neutral-900">
                    Create Your First Paper <span className="nlm-text">in Minutes</span>
                  </h3>
                  <p className="mb-6 text-sm sm:text-base text-neutral-500 max-w-xl mx-auto">
                    Pick your chapters, set difficulty and marks — get a complete CBSE-pattern paper with answer key, ready to print.
                  </p>
                  <div className="mb-8 flex flex-wrap justify-center gap-4">
                    {["NCERT content only", "Section-wise layout", "Answer key included"].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm text-neutral-600">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                          <Check className="h-3 w-3" />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button onClick={() => navigate("/dashboard/test-generator")} className="btn-grad px-8 py-3.5 text-sm sm:text-base w-full sm:w-auto">
                      🚀 Try Free — No Login Needed <ArrowRight className="ml-2 h-4 w-4 inline" />
                    </button>
                    <Link to={session ? "/dashboard/test-generator" : "/signup"} className="w-full sm:w-auto">
                      <button className="btn-glass-light px-8 py-3.5 text-sm sm:text-base w-full">Sign Up Free</button>
                    </Link>
                    <Link to="/pricing" className="w-full sm:w-auto">
                      <button className="btn-glass-light px-8 py-3.5 text-sm sm:text-base w-full flex items-center justify-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" /> View Pricing
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
const TrustSecurity = memo(function TrustSecurity() {
  return (
    <section className="relative py-20 bg-white">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mb-14 text-center">
          <span className="nlm-pill">🛡️ Built for Schools</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold md:text-5xl text-neutral-900">
            Trusted by <span className="nlm-text">Educators</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-neutral-500">
            Secure, reliable, and built specifically for Indian schools and coaching centres
          </p>
        </motion.div>
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TRUST_FEATURES.map((f) => (
            <motion.div key={f.title} variants={stackItem} className="ag-card p-6 text-center bg-white border border-neutral-100 shadow-sm">
              <div className="mb-3 text-3xl relative z-10">{f.icon}</div>
              <h3 className="mb-2 text-base font-semibold text-neutral-900 relative z-10">{f.title}</h3>
              <p className="text-xs sm:text-sm text-neutral-500 relative z-10 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   OUTCOMES STATS SECTION
   ══════════════════════════════════════════════ */
const Outcomes = memo(function Outcomes() {
  return (
    <section className="relative py-20 bg-white">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mb-14 text-center">
          <motion.div variants={stackItem} className="mx-auto mb-5 h-[3px] w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <h2 className="text-3xl sm:text-4xl font-bold md:text-5xl text-neutral-900">
            What You <span className="nlm-text">Get</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-neutral-500">
            Less paper-setting busywork. More teaching time. Better test papers.
          </p>
        </motion.div>
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {OUTCOME_STATS.map((s) => (
            <motion.div key={s.label} variants={stackItem} className="text-center">
              <div className="mb-2 text-5xl sm:text-6xl font-extrabold stat-n md:text-7xl">{s.value}</div>
              <h3 className="mb-1 text-base sm:text-lg font-semibold text-neutral-900">{s.label}</h3>
              <p className="text-xs sm:text-sm text-neutral-500 px-4">{s.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════
   TESTIMONIALS
   ══════════════════════════════════════════════ */
const Testimonials = memo(function Testimonials() {
  const loop = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];
  return (
    <section className="relative py-20 overflow-hidden bg-white">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mb-14 text-center">
          <span className="nlm-pill">💬 Community</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold md:text-5xl text-neutral-900">
            What <span className="nlm-text">Teachers</span> Say
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-neutral-500">
            Used by teachers across CBSE schools and coaching centres.
          </p>
        </motion.div>
      </div>

      <div className="relative bg-white py-4">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-white to-transparent" />
        <div className="marquee-track">
          {loop.map((t, i) => (
            <div key={`${t.name}-${i}`} className="ag-card p-6 relative flex-shrink-0 mx-3 bg-white border border-neutral-100 shadow-sm" style={{ width: 340, minHeight: 180 }}>
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
      <div className="absolute top-2 left-4 text-6xl font-serif leading-none text-emerald-500 opacity-20">"</div>
      <p className="relative mt-6 mb-6 text-sm leading-relaxed text-neutral-600 z-10">{t.quote}</p>
      <div className="flex items-center gap-3 relative z-10 mt-auto">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 border border-neutral-200">
          <User className="h-4 w-4 text-neutral-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-800">{t.name}</p>
          <p className="text-xs text-neutral-400">{t.role}</p>
        </div>
      </div>
    </>
  );
});

/* ══════════════════════════════════════════════
   FINAL CTA
   ══════════════════════════════════════════════ */
const FinalCTA = memo(function FinalCTA() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden py-24 bg-white">
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <motion.div variants={stackContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={stackItem} className="mx-auto mb-5 h-[3px] w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <motion.h2 variants={stackItem} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-neutral-900">
            Stop Spending
            <br className="hidden sm:block" /> Evenings on <span className="nlm-text">Paper-Setting</span>
          </motion.h2>
          <motion.p variants={stackItem} className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-neutral-500 leading-relaxed">
            Join teachers across India who create better test papers in minutes, not hours.
          </motion.p>
          <motion.div variants={stackItem} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button onClick={() => navigate("/dashboard/test-generator")} className="btn-grad px-10 py-4 text-sm sm:text-base w-full sm:w-auto">
              🚀 Try Free — No Login Needed <ArrowRight className="ml-2 h-4 w-4 inline" />
            </button>
            <Link to="/signup" className="w-full sm:w-auto">
              <button className="btn-glass-light px-10 py-4 text-sm sm:text-base w-full">Sign Up Free</button>
            </Link>
            <Link to="/pricing" className="w-full sm:w-auto">
              <button className="btn-glass-light px-10 py-4 text-sm sm:text-base w-full flex items-center justify-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" /> View Pricing
              </button>
            </Link>
          </motion.div>
          <motion.p variants={stackItem} className="mt-4 text-xs sm:text-sm text-neutral-400">
            2 free papers every month · No credit card needed
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
});