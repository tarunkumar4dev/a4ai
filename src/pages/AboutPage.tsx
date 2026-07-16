// src/pages/AboutPage.tsx
import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useMotionTemplate,
} from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Helmet } from "react-helmet";
import {
  Sparkles,
  Target,
  ShieldCheck,
  Rocket,
  Bolt,
  BookOpenCheck,
  Quote,
  ArrowRight,
  Gauge,
  Shield,
  BookOpen,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION (Forced Light Only)
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

const GlobalStyles = () => {
  useEffect(() => {
    // Explicitly lock down the global window document context to clean light space
    document.documentElement.style.background = "#ffffff !important";
    document.documentElement.style.backgroundColor = "#ffffff !important";
    document.documentElement.style.colorScheme = "light only !important";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; background-color: #ffffff !important; }
      html, body, #root, main, section { background: #ffffff !important; background-color: #ffffff !important; }
      
      .ag-card {
        border-radius: 18px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.85) !important;
        border: 1px solid rgba(0, 0, 0, 0.07) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(59,130,246,0.03), 0 2px 6px rgba(0,0,0,0.02) !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      
      @keyframes fast-gradient {
        0% { background-position: 0% center; }
        100% { background-position: -200% center; }
      }
      .nlm-text {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }

      /* Immutable Protected Black Glossy Button Engine */
      .btn-blk {
        position:relative; overflow:hidden;
        background: linear-gradient(180deg, #252629 0%, #0d0d0e 100%) !important;
        background-color: #0d0d0e !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 14px rgba(0,0,0,0.3) !important;
        color: #ffffff !important; font-weight:600;
        border-radius: 14px;
        transition: transform 0.2s, box-shadow 0.2s;
        -webkit-tap-highlight-color: transparent;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }
      .btn-blk * {
        color: #ffffff !important;
        stroke: #ffffff !important;
      }
      @media (hover: hover) {
        .btn-blk:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 20px rgba(0,0,0,0.4) !important; }
      }
      .btn-blk:active { transform: scale(0.96); }

      /* Immutable White Frosted Secondary Button */
      .btn-glass-light {
        position:relative; overflow:hidden;
        background: rgba(255, 255, 255, 0.75) !important;
        background-color: rgba(255, 255, 255, 0.75) !important;
        border: 1px solid #e5e7eb !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border-radius: 14px; font-weight:600;
        transition: transform 0.2s;
        color: #202124 !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        box-shadow: inset 0 1px 0 #ffffff, 0 2px 8px rgba(0,0,0,0.04) !important;
      }
      @media (hover: hover) {
        .btn-glass-light:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 #ffffff, 0 4px 14px rgba(0,0,0,0.08) !important; }
      }

      /* Clean Frosted Transparent Custom Tab Navigation Bar Dock */
      .force-light-dock {
        background-color: rgba(255, 255, 255, 0.45) !important;
        background: rgba(255, 255, 255, 0.45) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6), 0 8px 32px rgba(0, 0, 0, 0.03) !important;
      }

      .nlm-pill {
        display:inline-flex; align-items:center; gap:5px;
        padding:5px 14px; border-radius:999px; font-size:13px; font-weight:500;
        background: rgba(59,130,246,0.06); color: #1d4ed8; border: 1px solid rgba(59,130,246,0.14);
      }
      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(70px); }
      @media (min-width: 640px) { .sorb { filter: blur(100px); } }

      /* Hardcoded Metric Font Colors (Forces Deep Obsidian Black Counter Text) */
      .stat-n-forced {
        color: #111111 !important;
        font-weight: 800 !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

/* --- Light Visual Design Tokens --- */
const txtMuted = "#5f6368";
const txtHead = "#111111";
const accentColor = "#3b82f6";

/* ──────────────────────────────────────────────────────────────
   ROBUST VECTOR FALLBACK LOGO
   ────────────────────────────────────────────────────────────── */
const InlineVectorLogo = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 22H22L12 2Z" fill="url(#about-logo-grad)" />
    <path d="M12 6L5 19H19L12 6Z" fill="#ffffff" opacity="0.2" />
    <defs>
      <linearGradient id="about-logo-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#0ea5e9" />
      </linearGradient>
    </defs>
  </svg>
);

/* ──────────────────────────────────────────────────────────────
   SUB-TAB NAVIGATION FOR FLOATING BAR (LIGHT ENFORCED)
   ────────────────────────────────────────────────────────────── */
type AboutTabKey = "mission" | "values" | "team";

function AboutSubTabNav({ value, onChange }: { value: AboutTabKey; onChange: (v: AboutTabKey) => void }) {
  const tabs = [
    { id: "mission", label: "Mission" },
    { id: "values", label: "Values" },
    { id: "team", label: "Team" },
  ];

  return (
    <div className="inline-flex rounded-xl p-1 bg-white/60 border border-neutral-200 shadow-sm backdrop-blur">
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id as AboutTabKey)}
            className={`relative rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors duration-200 ${
              active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {active && (
              <span className="absolute inset-0 rounded-lg bg-blue-500/10" />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ================== Data Restored (Krishna Removed) ================== */
const team = [
  { name: "Tarun Pathak", role: "Co-Founder", description: "Product · Marketing", image: "/images/tarun_a4ai.jpeg" },
  { name: "Yash Dubey", role: "Co-Founder", description: "Full Stack Developer", image: "/images/yash_a4ai.jpg" },
  { name: "Aakash Singh", role: "Co-Founder", description: "Cloud · Infra · Frontend", image: "/images/aakash_a4ai.jpg" },
];

const values = [
  { icon: Target, k: "Outcomes > Outputs", v: "We obsess over student learning gains and teacher time saved." },
  { icon: ShieldCheck, k: "Trust by design", v: "Privacy‑first data handling with clear controls and audit trails." },
  { icon: BookOpenCheck, k: "Pedagogy‑aware AI", v: "Questions that align to curriculum, not just prompt magic." },
  { icon: Bolt, k: "Speed with dignity", v: "From prompt to paper in under 2 min—without cutting corners." },
];

const milestones = [
  { date: "Apr 2025", title: "a4ai is founded", detail: "Validated the pain: teachers spend 6–10 hrs/week creating papers." },
  { date: "Jun 2025", title: "Private alpha", detail: "First 50 teachers, 1K+ papers generated; tight build‑with loop." },
  { date: "Aug 2025", title: "Contest engine MVP", detail: "Proctored live contests with camera checks & screen‑lock." },
  { date: "Q4 2025", title: "Institutes beta", detail: "Custom branding, SSO, and advanced analytics for campuses." },
];

const testimonials = [
  {
    quote: "We cut paper‑setting time by 80% and standardised difficulty across sections.",
    name: "Ritika Sharma",
    title: "HOD Science, Delhi",
  },
  {
    quote: "Proctoring is surprisingly humane—alerts were actionable and didn't overwhelm invigilators.",
    name: "Arvind Rao",
    title: "Principal, Pune",
  },
];

/* Updated Partner Content Array */
const partners = [
  { name: "Chanakya Institute", logo: "/images/partner-msit.svg" },
  { name: "Education Beast", logo: "/images/partner-cbse.svg" },
  { name: "CBSE", logo: "/images/partner-skilled.svg" },
  { name: "SkillED", logo: "/images/partner-edulabs.svg" },
];

const sectionX = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

/* ================== Page Component ================== */
export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<AboutTabKey>("mission");
  const [logoFailed, setLogoFailed] = useState(false);

  const navigate = useNavigate();

  const missionRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef<HTMLDivElement | null>(null);
  const teamRef = useRef<HTMLDivElement | null>(null);

  const handleTabChange = (tabId: AboutTabKey) => {
    setActiveTab(tabId);
    const targetRef = 
      tabId === "mission" ? missionRef : 
      tabId === "values" ? valuesRef : teamRef;
      
    if (targetRef.current) {
      const offsetPosition = targetRef.current.getBoundingClientRect().top + window.pageYOffset - 110;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  const mx = useMotionValue(360);
  const my = useMotionValue(180);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, rgba(59,130,246,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), rgba(96,165,250,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), rgba(129,140,248,0.03), transparent 70%)
  `;

  const missionInView = useInView(missionRef, { once: true, margin: "-12% 0px" });

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "a4ai",
    url: "https://a4ai.in",
    logo: "https://a4ai.in/images/logo.png",
    sameAs: ["https://x.com/a4ai", "https://www.linkedin.com/company/a4ai"],
  };

  return (
    <>
      <Helmet>
        <title>About a4ai — Smart, simple, secure assessments</title>
        <meta name="description" content="We're a small team building AI‑powered test generation, proctoring, and analytics that respect pedagogy and privacy." />
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
        <meta property="og:title" content="About a4ai" />
        <meta property="og:description" content="AI-powered assessments for real classrooms." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div onMouseMove={onMove} className="lp min-h-screen relative overflow-hidden bg-white">
        <GlobalStyles />

        {/* Background Orbs */}
        <div className="hidden sm:block">
          <div className="sorb" style={{ width: 600, height: 600, right: -150, top: -100, background: "rgba(59,130,246,0.03)" }} />
          <div className="sorb" style={{ width: 500, height: 500, left: -100, bottom: "20%", background: "rgba(129,140,248,0.03)" }} />
        </div>

        {/* Grid Overlay */}
        <div
          className="absolute inset-0 -z-20 pointer-events-none"
          style={{
            opacity: 0.015,
            backgroundImage: "linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-100"
          style={{ backgroundImage: bgGlow as any }}
        />

        {/* FLOATING TOP NAVIGATION HEADER */}
        <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
          <nav className="mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl relative overflow-hidden transition-all duration-300 force-light-dock">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 bg-transparent">
              <Link to="/" className="group flex items-center gap-2.5 select-none text-lg font-semibold tracking-tight transition-opacity active:opacity-90">
                <div className="h-6 w-6 flex items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/20 overflow-hidden">
                  {!logoFailed ? (
                    <img 
                      src="/ICON.ico" 
                      alt="Logo" 
                      className="h-full w-full object-contain"
                      onError={() => setLogoFailed(true)}
                    />
                  ) : (
                    <InlineVectorLogo />
                  )}
                </div>
                <span style={{ color: txtHead }}>
                  a4ai <span className="text-xs font-normal opacity-60 ml-1">About</span>
                </span>
              </Link>
              <AboutSubTabNav value={activeTab} onChange={handleTabChange} />
            </div>
          </nav>
        </div>

        <div className="pt-24 relative z-10 bg-white">

          {/* HERO BANNER SECTION */}
          <section className="relative z-10 py-16 md:py-20 bg-white">
            <div className={sectionX}>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                <span className="nlm-pill"><Sparkles className="h-3.5 w-3.5"/> Founded 2025</span>
                <span className="nlm-pill"><Rocket className="h-3.5 w-3.5"/> Contest engine live</span>
                <span className="nlm-pill"><ShieldCheck className="h-3.5 w-3.5"/> Privacy‑first</span>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="text-center text-[34px] md:text-5xl lg:text-6xl leading-[1.15] font-extrabold tracking-tight text-neutral-900"
              >
                About <span className="nlm-text">a4ai</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
                className="mx-auto mt-6 max-w-3xl text-center text-lg md:text-xl"
                style={{ color: txtMuted }}
              >
                Building the assessment stack for Indian classrooms—fast, fair, and aligned to how teachers actually teach.
              </motion.p>

              {/* Counter Statistics Metrics (Fonts locked to Black) */}
              <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { k: "Papers", v: "3.5K+" },
                  { k: "Schools", v: "25+" },
                  { k: "Uptime", v: "99.9%" },
                  { k: "Avg. Gen Time", v: "< 2 min" },
                ].map((s) => (
                  <motion.div
                    key={s.k}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="p-6 text-center ag-card bg-white"
                  >
                    <div className="text-2xl md:text-3xl font-extrabold tracking-tight stat-n-forced">{s.v}</div>
                    <div className="mt-1 text-sm font-medium" style={{ color: txtMuted }}>{s.k}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* MISSION STRUC BLOCK */}
          <section ref={missionRef} className="relative z-10 py-16 scroll-mt-28 bg-white">
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={missionInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="[&_h2]:tracking-tight bg-transparent"
              >
                <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900">Our mission</h2>
                <p className="mt-6 text-lg leading-relaxed" style={{ color: txtMuted }}>
                  Give teachers superpowers with AI that respects context and curriculum. Save hours weekly and return that time to students.
                </p>
                <p className="mt-4 text-lg leading-relaxed" style={{ color: txtMuted }}>
                  We combine multi‑LLM generation with rubric checks, plagiarism guards,
                  and contest‑grade proctoring to ensure quality from day one.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <button onClick={() => navigate("/features")} className="btn-blk px-8 py-3.5 text-base sm:text-lg">
                    <span className="relative z-10 flex items-center justify-center gap-2">See how it works</span>
                  </button>
                  <button onClick={() => navigate("/contact")} className="btn-glass-light px-8 py-3.5 text-base sm:text-lg">
                    <span className="relative z-10 flex items-center justify-center gap-2">Talk to us</span>
                  </button>
                </div>

                <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { icon: Gauge, title: "Faster prep", copy: "Create aligned tests in minutes, not evenings." },
                    { icon: Shield, title: "Safer data", copy: "Privacy-first storage, clear consent, audit trails." },
                    { icon: BookOpen, title: "Better pedagogy", copy: "Curriculum mapping + rubric checks by default." },
                  ].map((item) => (
                    <div key={item.title} className="p-5 ag-card bg-white">
                      <div className="flex items-center gap-2 font-semibold text-neutral-800">
                        <item.icon className="h-4 w-4" style={{ color: accentColor }} />
                        {item.title}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: txtMuted }}>{item.copy}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 40 }} animate={missionInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                <div className="overflow-hidden p-0 ag-card bg-white shadow-sm border border-neutral-200/60">
                  <img
                    src="/images/bg.jpg"
                    alt="Educators using a4ai"
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            </div>
          </section>

          {/* VALUES SYSTEM GRID */}
          <section ref={valuesRef} className="relative z-10 py-16 scroll-mt-28 bg-white">
            <div className={sectionX}>
              <div className="mb-12 text-center bg-transparent">
                <h3 className="text-3xl font-extrabold text-neutral-900">What we value</h3>
                <p className="mt-3 text-neutral-500">Principles that steer product and policy.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {values.map((x, i) => (
                  <motion.div
                    key={x.k}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 * i, duration: 0.5, ease: "easeOut" }}
                    className="p-6 ag-card bg-white"
                  >
                    <div className="flex items-center gap-3 mb-4 bg-transparent">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 bg-blue-50 border border-blue-100">
                        <x.icon className="h-5 w-5" style={{ color: accentColor }} />
                      </div>
                      <div className="font-semibold text-neutral-800">{x.k}</div>
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-500">{x.v}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* MILESTONES TIMELINE BLOCK */}
          <section className="relative z-10 py-16 bg-white">
            <div className="mx-auto max-w-5xl px-4 bg-transparent">
              <h3 className="text-3xl font-extrabold text-center text-neutral-900">Milestones</h3>
              <div className="mt-12 space-y-6 bg-transparent">
                {milestones.map((m, i) => (
                  <motion.div
                    key={m.title}
                    initial={{ opacity: 0, x: i % 2 ? 40 : -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="grid grid-cols-1 gap-4 p-6 md:grid-cols-[140px_1fr] ag-card bg-white"
                  >
                    <div className="text-sm font-semibold mt-1 text-blue-600">{m.date}</div>
                    <div>
                      <div className="text-lg font-bold text-neutral-900">{m.title}</div>
                      <div className="mt-2 text-sm leading-relaxed text-neutral-500">{m.detail}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* TEAM PROFILE LINKS SECTION */}
          <section ref={teamRef} className="relative z-10 py-16 scroll-mt-28 bg-white">
            <div className={sectionX}>
              <div className="text-center bg-transparent">
                <motion.h2 {...fadeUp} className="text-3xl md:text-4xl font-extrabold mb-6 text-neutral-900">
                  Team Behind a4ai
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="mx-auto max-w-3xl text-lg text-neutral-500"
                >
                  A small team building a4ai — step by step, every day.
                </motion.p>
              </div>

              <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto bg-transparent">
                {team.map((m, i) => (
                  <TeamCard key={m.name} index={i} member={m} />
                ))}
              </div>

              <p className="mt-12 text-center text-sm font-medium text-neutral-400">
                …and many more people who quietly help shape a4ai every moment.
              </p>
            </div>
          </section>

          {/* PARTNERS ROW LAYOUT */}
          <section className="relative z-10 py-16 bg-white">
            <div className="mx-auto max-w-6xl px-4 bg-transparent">
              <div className="text-center bg-transparent">
                <h3 className="text-3xl font-extrabold text-neutral-900">Schools & partners</h3>
                <p className="mt-3 text-neutral-500">Pilots and early adopters we're grateful for.</p>
              </div>
              <div className="mt-12 grid grid-cols-2 items-center gap-6 sm:grid-cols-4 bg-transparent">
                {partners.map((p) => (
                  <div key={p.name} className="flex items-center justify-center p-8 ag-card bg-white border border-neutral-100 shadow-sm">
                    <span className="text-sm font-semibold tracking-wide text-neutral-700 hover:text-neutral-900 transition-colors">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* TESTIMONIAL BLOCKQUOTES */}
          <section className="relative z-10 py-16 bg-white">
            <div className="mx-auto max-w-5xl px-4 bg-transparent">
              <div className="grid gap-6 md:grid-cols-2 bg-transparent">
                {testimonials.map((t, i) => (
                  <motion.blockquote
                    key={t.name}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.05 * i, ease: "easeOut" }}
                    className="relative p-8 ag-card bg-white border border-neutral-100 shadow-sm flex flex-col"
                  >
                    <Quote className="absolute -top-3 -left-3 h-8 w-8 text-neutral-200/50" />
                    <p className="text-base leading-relaxed italic text-neutral-800">"{t.quote}"</p>
                    <footer className="mt-6 text-sm bg-transparent">
                      <span className="font-semibold text-neutral-800">{t.name}</span>,{" "}
                      <span style={{ color: txtMuted }}>{t.title}</span>
                    </footer>
                  </motion.blockquote>
                ))}
              </div>
            </div>
          </section>

          {/* CTA BOTTOM BANNER BLOCK */}
          <section className="relative z-10 pb-24 pt-10 bg-white">
            <div className={sectionX}>
              <motion.div {...fadeUp} viewport={{ once: true }} className="rounded-2xl p-[1px] shadow-sm overflow-hidden" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
                <div className="rounded-2xl px-6 py-16 text-center relative bg-white/95 backdrop-blur-md">
                  <motion.h2
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900"
                  >
                    Ready to transform your assessments?
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                    className="mx-auto mt-4 max-w-2xl text-lg text-neutral-500"
                  >
                    Join educators using a4ai to save time and improve outcomes.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25, duration: 0.5 }}
                    className="mt-8 flex flex-col sm:flex-row justify-center gap-4 bg-transparent"
                  >
                    <button onClick={() => navigate("/")} className="btn-blk px-8 py-3.5 text-base sm:text-lg">
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Get started for free
                      </span>
                    </button>
                    <button onClick={() => navigate("/contact")} className="btn-glass-light px-8 py-3.5 text-base sm:text-lg flex items-center justify-center gap-2">
                      <span className="relative z-10 flex items-center gap-2">Book a demo <ArrowRight className="h-5 w-5" /></span>
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}

/* ================== Team Card Profile Renderer ================== */
function TeamCard({
  member,
  index,
}: {
  member: { name: string; role: string; description: string; image: string };
  index: number;
}) {
  const mx = useMotionValue(160);
  const my = useMotionValue(120);
  const rotateX = useTransform(my, [0, 260], [8, -8]);
  const rotateY = useTransform(mx, [0, 300], [-10, 10]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.08 * index, ease: EASE }}
      className="relative bg-white"
    >
      <div 
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mx.set(e.clientX - rect.left);
          my.set(e.clientY - rect.top);
        }} 
        onMouseLeave={() => { mx.set(160); my.set(120); }} 
        style={{ perspective: 1000 }} 
        className="group cursor-pointer h-full"
      >
        <motion.div
          style={{ rotateX, rotateY }}
          className="relative h-full p-6 transition-all duration-300 ag-card bg-white"
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
          />
          <div className="relative z-10 text-center bg-transparent">
            <Avatar className="mx-auto mb-4 h-28 w-28 ring-2 ring-neutral-100 border border-neutral-200/50">
              <AvatarImage src={member.image} alt={member.name} className="object-cover" />
              <AvatarFallback className="text-xl font-bold bg-neutral-50 text-neutral-800">
                {member.name.substring(0, 2)}
              </AvatarFallback>
            </Avatar>

            <h3 className="text-xl font-extrabold text-neutral-900">{member.name}</h3>
            <p className="mt-1 text-sm font-semibold text-blue-600">{member.role}</p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">{member.description}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}