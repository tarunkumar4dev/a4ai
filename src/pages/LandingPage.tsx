import React, { lazy, Suspense, memo, useState, useEffect, useRef } from "react";
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
      .lp { font-family: 'DM Sans', sans-serif; }

      /* Scroll reveal */
      .rv { opacity:0; transform:translateY(18px); transition:opacity 0.55s cubic-bezier(.16,1,.3,1),transform 0.55s cubic-bezier(.16,1,.3,1); }
      .rv.in { opacity:1; transform:translateY(0); }

      /* Apple glass card */
      .ag-card {
        border-radius: 20px;
        transition: transform 0.25s cubic-bezier(.16,1,.3,1), box-shadow 0.25s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
      }
      .ag-card-light {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(0,0,0,0.08);
        backdrop-filter: blur(40px) saturate(180%);
        -webkit-backdrop-filter: blur(40px) saturate(180%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 24px rgba(66,133,244,0.06), 0 2px 8px rgba(0,0,0,0.06);
      }
      .ag-card-light::before {
        content:''; position:absolute; inset:0; border-radius:20px; pointer-events:none;
        background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 40%);
      }
      .ag-card-dark {
        background: rgba(20,25,40,0.65);
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(40px) saturate(180%);
        -webkit-backdrop-filter: blur(40px) saturate(180%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.5);
      }
      .ag-card-dark::before {
        content:''; position:absolute; inset:0; border-radius:20px; pointer-events:none;
        background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 45%);
      }
      .ag-card:hover {
        transform: translateY(-3px);
      }
      .ag-card-light:hover {
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 12px 40px rgba(66,133,244,0.12), 0 4px 16px rgba(0,0,0,0.08);
      }
      .ag-card-dark:hover {
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 40px rgba(0,0,0,0.6);
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
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.3), 0 10px 30px rgba(0,0,0,0.25);
        color: white; font-weight:600;
        border-radius: 16px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .btn-blk::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.16) 0%,transparent 100%);
        pointer-events:none;
      }
      .btn-blk:hover { transform:translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -1px 0 rgba(0,0,0,0.3),0 4px 10px rgba(0,0,0,0.4),0 16px 40px rgba(0,0,0,0.3); }

      /* macOS Glossy Greyish Glass Button */
      .btn-glass-light {
        position:relative; overflow:hidden;
        background: rgba(235, 235, 240, 0.85);
        border: 1px solid rgba(0,0,0,0.12);
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 2px 10px rgba(0,0,0,0.07);
        border-radius: 16px; font-weight:600;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .btn-glass-light::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%);
        pointer-events:none;
      }
      .btn-glass-light:hover { transform:translateY(-2px); box-shadow:inset 0 1px 0 rgba(255,255,255,1),0 6px 20px rgba(0,0,0,0.11); }

      .btn-glass-dark {
        position:relative; overflow:hidden;
        background: rgba(60, 60, 65, 0.7);
        border: 1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.4);
        border-radius: 16px; font-weight:600;
        transition: transform 0.2s;
      }
      .btn-glass-dark::before {
        content:''; position:absolute; inset-inline:0; top:0; height:50%;
        background: linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 100%);
        pointer-events:none;
      }
      .btn-glass-dark:hover { transform:translateY(-2px); }

      /* Pill */
      .nlm-pill {
        display:inline-flex; align-items:center; gap:6px;
        padding:5px 14px; border-radius:999px; font-size:13px; font-weight:500;
      }

      /* Section orb */
      .sorb { position:absolute; border-radius:50%; pointer-events:none; }

      /* Stat shimmer */
      .stat-n {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text; 
        -webkit-text-fill-color: transparent; 
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }
      .dark .stat-n {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text; 
        -webkit-text-fill-color: transparent; 
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  return null;
};

const useReveal = (delay = 0) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const t = setTimeout(() => {
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); obs.unobserve(el); } }, { threshold: 0.1, rootMargin: "30px 0px" });
      obs.observe(el);
      return () => obs.disconnect();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
};

const useInView = () => {
  const [ref, setRef] = useState(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.unobserve(ref); } }, { threshold: 0.1 });
    obs.observe(ref); return () => obs.disconnect();
  }, [ref]);
  return [setRef, inView];
};

const LazySection = memo(({ children }) => {
  const [setRef, inView] = useInView();
  return <div ref={setRef}>{inView && children}</div>;
});

export default function LandingPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className="lp flex min-h-screen flex-col" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <GlobalStyles />
      <Navbar />
      <main className="flex-grow">
        <LandingHero />
        <Suspense fallback={<div className="h-96" />}><LazySection><OptimizedDemo /></LazySection></Suspense>
        <Suspense fallback={<div className="h-96" />}><LazySection><LandingFeatures /></LazySection></Suspense>
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

const card = (isDark) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
const pill = (isDark) => ({ className: "nlm-pill", style: { background: isDark ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.07)", color: isDark ? "#4ade80" : "#059669", border: isDark ? "1px solid rgba(74,222,128,0.18)" : "1px solid rgba(74,222,128,0.12)" } });
const muted = (isDark) => isDark ? "#5f6b7a" : "#5f6368";
const head = (isDark) => isDark ? "#f1f5f9" : "#111111";

/* ── How It Works ── */
const HowItWorks = memo(function HowItWorks({ isDark }) {
  const tr = useReveal();
  const sr = [useReveal(60), useReveal(120), useReveal(180)];
  return (
    <section className="relative overflow-hidden py-24" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="sorb" style={{ width: 500, height: 500, right: -100, top: -100, background: isDark ? "rgba(45,212,191,0.06)" : "rgba(45,212,191,0.04)", filter: "blur(80px)" }} />
      <div className="sorb" style={{ width: 400, height: 400, left: -80, bottom: -50, background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)", filter: "blur(80px)" }} />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-16 text-center">
          <span {...pill(isDark)}><Sparkles className="h-3.5 w-3.5" />3 Steps, 2 Minutes</span>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>
            How It <span className="nlm-text">Works</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: muted(isDark) }}>Pick chapters, set marks — get a print-ready CBSE paper</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {HOW_STEPS.map(({ title, desc, Icon }, i) => (
            <div key={title} ref={sr[i]} className={`rv ${card(isDark)} p-8`}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>{i + 1}</div>
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(45,212,191,0.2),transparent)" }} />
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: isDark ? "rgba(45,212,191,0.1)" : "rgba(45,212,191,0.07)", border: isDark ? "1px solid rgba(45,212,191,0.15)" : "1px solid rgba(45,212,191,0.1)" }}>
                  <Icon className="h-4.5 w-4.5" style={{ color: isDark ? "#2dd4bf" : "#0d9488" }} />
                </div>
              </div>
              <h3 className="mb-2 text-lg font-semibold relative z-10" style={{ color: head(isDark) }}>{title}</h3>
              <p className="text-sm leading-relaxed relative z-10" style={{ color: muted(isDark) }}>{desc}</p>
            </div>
          ))}
        </div>
        <UpgradedCTA isDark={isDark} />
      </div>
    </section>
  );
});

const UpgradedCTA = memo(function UpgradedCTA({ isDark }) {
  const { session } = useAuth();
  const ref = useReveal();
  return (
    <div ref={ref} className="rv mx-auto mt-20 max-w-4xl">
      <div className="p-px rounded-3xl" style={{ background: "linear-gradient(135deg,rgba(74,222,128,0.35),rgba(129,140,248,0.35))" }}>
        <div className="rounded-3xl p-10 text-center relative overflow-hidden"
          style={{ background: isDark ? "rgba(10,14,24,0.9)" : "rgba(248,252,255,0.95)", backdropFilter: "blur(40px) saturate(180%)" }}>
          <div className="sorb" style={{ width: 300, height: 300, right: -80, top: -80, background: "rgba(74,222,128,0.08)", filter: "blur(50px)" }} />
          <div className="sorb" style={{ width: 300, height: 300, left: -80, bottom: -80, background: "rgba(129,140,248,0.08)", filter: "blur(50px)" }} />
          {/* Top glass sheen */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-3xl" style={{ background: isDark ? "linear-gradient(180deg,rgba(255,255,255,0.04) 0%,transparent 100%)" : "linear-gradient(180deg,rgba(255,255,255,0.7) 0%,transparent 100%)" }} />
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
              style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.07)", backdropFilter: "blur(20px)", color: isDark ? "#8a9bb0" : "#5f6368" }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: "#2dd4bf" }} />2 free papers every month
            </div>
            <h3 className="mb-4 text-3xl font-bold" style={{ color: head(isDark) }}>Create Your First Paper <span className="nlm-text">in Minutes</span></h3>
            <p className="mb-7 leading-relaxed" style={{ color: muted(isDark) }}>Pick your chapters, set difficulty and marks — get a complete CBSE-pattern paper with answer key, ready to print.</p>
            <div className="mb-7 flex flex-wrap justify-center gap-5">
              {["NCERT content only", "Section-wise layout", "Answer key included"].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}><Check className="h-3 w-3 text-white" /></div>{f}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to={session ? "/dashboard/test-generator" : "/signup"}>
                <button className="btn-blk px-8 py-3 text-base"><span className="relative z-10 flex items-center gap-2">Try for FREE <ArrowRight className="h-4 w-4" /></span></button>
              </Link>
              <Link to="/pricing">
                <button className={`px-8 py-3 text-base ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
                  <span className="relative z-10 flex items-center gap-2"><Crown className="h-4 w-4" /> View Pricing</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ── Trust Security ── */
const TrustSecurity = memo(function TrustSecurity({ isDark }) {
  const tr = useReveal();
  const cr = [useReveal(60), useReveal(100), useReveal(140), useReveal(180)];
  return (
    <section className="relative py-24" style={{ background: isDark ? "#050810" : "#f8fafe" }}>
      <div className="sorb" style={{ width: 600, height: 400, left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: isDark ? "rgba(96,165,250,0.04)" : "rgba(96,165,250,0.03)", filter: "blur(90px)" }} />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-16 text-center">
          <span {...pill(isDark)}>🛡️ Built for Schools</span>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>Trusted by <span className="nlm-text">Educators</span></h2>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: muted(isDark) }}>Secure, reliable, and built specifically for Indian schools and coaching centres</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_FEATURES.map((f, i) => (
            <div key={f.title} ref={cr[i]} className={`rv ${card(isDark)} p-7 text-center`}>
              <div className="mb-3 text-3xl relative z-10">{f.icon}</div>
              <h3 className="mb-2 text-base font-semibold relative z-10" style={{ color: head(isDark) }}>{f.title}</h3>
              <p className="text-sm leading-relaxed relative z-10" style={{ color: muted(isDark) }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── Outcomes ── */
const Outcomes = memo(function Outcomes({ isDark }) {
  const tr = useReveal();
  const sr = [useReveal(60), useReveal(120), useReveal(180)];
  return (
    <section className="relative py-24" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="sorb" style={{ width: 500, height: 300, left: "50%", bottom: -50, transform: "translateX(-50%)", background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)", filter: "blur(80px)" }} />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-16 text-center">
          <div className="mx-auto mb-5 h-[3px] w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <h2 className="text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>What You <span className="nlm-text">Get</span></h2>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: muted(isDark) }}>Less paper-setting busywork. More teaching time. Better test papers.</p>
        </div>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {OUTCOME_STATS.map((s, i) => (
            <div key={s.label} ref={sr[i]} className="rv text-center">
              <div className="mb-2 text-6xl font-extrabold stat-n md:text-7xl">{s.value}</div>
              <h3 className="mb-1 text-lg font-semibold" style={{ color: head(isDark) }}>{s.label}</h3>
              <p className="text-sm" style={{ color: muted(isDark) }}>{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── Testimonials ── */
const Testimonials = memo(function Testimonials({ isDark }) {
  const tr = useReveal();
  const cr = [useReveal(60), useReveal(120), useReveal(180)];
  return (
    <section className="relative py-24" style={{ background: isDark ? "#050810" : "#f8fafe" }}>
      <div className="sorb" style={{ width: 450, height: 450, right: -100, top: "15%", background: isDark ? "rgba(45,212,191,0.05)" : "rgba(45,212,191,0.03)", filter: "blur(80px)" }} />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div ref={tr} className="rv mb-16 text-center">
          <span {...pill(isDark)}>💬 Community</span>
          <h2 className="mt-4 text-4xl font-bold md:text-5xl" style={{ color: head(isDark) }}>What <span className="nlm-text">Teachers</span> Say</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: muted(isDark) }}>Used by teachers across CBSE schools and coaching centres.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} ref={cr[i]} className={`rv ${card(isDark)} p-8 relative`}>
              <div className="absolute top-4 left-5 text-6xl font-serif leading-none" style={{ color: "#2dd4bf", opacity: 0.12 }}>"</div>
              <p className="relative mt-6 mb-6 text-sm leading-relaxed z-10" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>{t.quote}</p>
              <div className="flex items-center gap-3 relative z-10">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)" }}>
                  <User className="h-5 w-5" style={{ color: isDark ? "#c8d4e0" : "#5f6368" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: head(isDark) }}>{t.name}</p>
                  <p className="text-xs" style={{ color: muted(isDark) }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── Final CTA ── */
const FinalCTA = memo(function FinalCTA({ isDark }) {
  const ref = useReveal();
  return (
    <section className="relative overflow-hidden py-28" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="sorb" style={{ width: 700, height: 400, left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.04)", filter: "blur(80px)" }} />
      <div className="relative mx-auto max-w-4xl px-4 text-center">
        <div ref={ref} className="rv">
          <div className="mx-auto mb-5 h-[3px] w-12 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
          <h2 className="text-5xl font-bold md:text-6xl lg:text-7xl leading-tight" style={{ color: head(isDark) }}>
            Stop Spending<br />Evenings on <span className="nlm-text">Paper-Setting</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed" style={{ color: muted(isDark) }}>Join teachers across India who create better test papers in minutes, not hours.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/signup">
              <button className="btn-blk px-10 py-4 text-base"><span className="relative z-10 flex items-center gap-2">Try for FREE <ArrowRight className="h-4 w-4" /></span></button>
            </Link>
            <Link to="/pricing">
              <button className={`px-10 py-4 text-base ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
                <span className="relative z-10 flex items-center gap-2"><Crown className="h-4 w-4" /> View Pricing</span>
              </button>
            </Link>
          </div>
          <p className="mt-4 text-sm" style={{ color: muted(isDark) }}>2 free papers every month · No credit card needed</p>
        </div>
      </div>
    </section>
  );
});