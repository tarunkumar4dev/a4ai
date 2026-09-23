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
  Check,
  HeartHandshake,
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
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

      .lp-about-wrapper, .lp-about-wrapper * {
        font-family: 'Plus Jakarta Sans', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        -webkit-font-smoothing: antialiased;
      }
      
      html, body, #root, main, section { background: #ffffff !important; background-color: #ffffff !important; }

      .about-card {
        border-radius: 24px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1), border-color 0.22s ease;
        position: relative;
        background: rgba(255, 255, 255, 0.95) !important;
        border: 1px solid rgba(226, 232, 240, 0.9) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02) !important;
      }

      @media (hover: hover) {
        .about-card:hover {
          transform: translateY(-4px) !important;
          border-color: rgba(147, 197, 253, 0.9) !important;
          box-shadow: 0 20px 40px -12px rgba(59, 130, 246, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04) !important;
        }
      }

      .btn-blue-gradient {
        background: linear-gradient(180deg, #93c5fd 0%, #3b82f6 85%) !important;
        color: #ffffff !important;
        border: 1px solid #60a5fa !important;
        box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        border-radius: 14px;
        font-weight: 700;
      }
      .btn-blue-gradient * { color: #ffffff !important; stroke: #ffffff !important; }
      @media (hover: hover) { 
        .btn-blue-gradient:hover { 
          filter: brightness(1.05); 
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.38) !important; 
        } 
      }

      .btn-white-action {
        background: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #e2e8f0 !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        border-radius: 14px;
        font-weight: 700;
      }
      .btn-white-action * { color: #0f172a !important; stroke: #0f172a !important; }
      @media (hover: hover) {
        .btn-white-action:hover {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07) !important;
        }
      }

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

      /* Clean Frosted Transparent Custom Tab Navigation Bar Dock */
      .force-light-dock {
        background-color: rgba(255, 255, 255, 0.7) !important;
        background: rgba(255, 255, 255, 0.7) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(226, 232, 240, 0.8) !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 32px rgba(0, 0, 0, 0.04) !important;
      }

      .per-student-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #eff6ff;
        border: 1px solid #dbeafe;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
      }

      .nlm-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        background: rgba(59,130,246,0.06);
        color: #1d4ed8;
        border: 1px solid rgba(59,130,246,0.14);
      }
      .sorb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(70px); }
      @media (min-width: 640px) { .sorb { filter: blur(100px); } }

      .stat-n-forced {
        color: #0f172a !important;
        font-weight: 900 !important;
        letter-spacing: -0.02em !important;
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
    <div className="inline-flex rounded-2xl p-1.5 bg-white/90 border border-slate-200 shadow-sm backdrop-blur">
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id as AboutTabKey)}
            className={
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition " +
              (active
                ? "bg-slate-900 text-white shadow-sm ring-1 ring-black/5"
                : "text-slate-700 hover:bg-slate-100/70 ring-1 ring-transparent")
            }
          >
            {t.label}
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

export interface ValueItem {
  icon: React.ElementType;
  title: string;
  tag?: string;
  description: string;
  bullets: string[];
  tags: string[];
  cta?: string;
  href?: string;
}

const values: ValueItem[] = [
  {
    icon: Target,
    title: "Outcomes Over Outputs",
    tag: "Core Focus",
    description: "We obsess over genuine student learning gains and teacher hours saved, not vanity paper counts or bloated metric dashboards.",
    bullets: [
      "Obsess over measurable learning improvements",
      "Save 6–10 hours of manual test prep weekly",
      "Actionable chapter-level weakness analytics",
    ],
    tags: ["Pedagogy", "Impact"],
    cta: "See Impact",
    href: "/features",
  },
  {
    icon: ShieldCheck,
    title: "Trust & Privacy By Design",
    tag: "Security",
    description: "Indian classroom data belongs strictly to teachers and institutions. Never monetized, sold, or used to train public AI models.",
    bullets: [
      "Zero student profiling or advertising",
      "End-to-end encrypted storage & audit trails",
      "Strict role-based teacher permissions",
    ],
    tags: ["Privacy", "Security"],
    cta: "Read Security",
    href: "/resources",
  },
  {
    icon: BookOpenCheck,
    title: "Curriculum-Aware Intelligence",
    tag: "Pedagogy",
    description: "Every question is grounded in official NCERT/CBSE syllabi and Bloom's Taxonomy, eliminating generic internet hallucinations.",
    bullets: [
      "1 Lakh+ verified NCERT question library",
      "Precise cognitive depth & difficulty spread",
      "Step-by-step marking schemes & rationales",
    ],
    tags: ["NCERT", "CBSE"],
    cta: "Curriculum",
    href: "/features",
  },
  {
    icon: Bolt,
    title: "Speed With Academic Dignity",
    tag: "Efficiency",
    description: "From concept prompt to a print-ready test paper in under 2 minutes—preserving formatting, mathematical formulas, and diagrams.",
    bullets: [
      "Instant bilingual (English/Hindi) papers",
      "Print-ready PDF layout with school branding",
      "1-click answer key & teacher solution sheets",
    ],
    tags: ["Workflow", "Speed"],
    cta: "Generator",
    href: "/features",
  },
  {
    icon: Shield,
    title: "Humane & Fair Proctoring",
    tag: "Integrity",
    description: "Anti-cheat safeguards designed to deter dishonest practices without inducing student anxiety or overwhelming invigilators.",
    bullets: [
      "Non-intrusive tab & camera anomaly flags",
      "Actionable teacher review logs (no false alarms)",
      "Zero invasive software installs needed",
    ],
    tags: ["Proctoring", "Fairness"],
    cta: "Contest Engine",
    href: "/features",
  },
  {
    icon: HeartHandshake,
    title: "Accessible To Every School",
    tag: "Inclusion",
    description: "Engineered lightweight and mobile-first so individual tutors, state board schools, and large university networks alike can thrive.",
    bullets: [
      "Instant WhatsApp & QR test distribution",
      "Works reliably even on 3G & low bandwidth",
      "Generous free tier for individual educators",
    ],
    tags: ["Accessibility", "Schools"],
    cta: "Community",
    href: "/resources",
  },
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
  const rafId = useRef<number | null>(null);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const currentTarget = e.currentTarget;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!currentTarget) return;
      const r = currentTarget.getBoundingClientRect();
      mx.set(clientX - r.left);
      my.set(clientY - r.top);
    });
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

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

      <div onMouseMove={onMove} className="lp-about-wrapper min-h-screen relative overflow-hidden bg-white">
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
              <Link to="/" className="group flex items-center gap-2.5 select-none text-lg font-extrabold tracking-tight transition-opacity active:opacity-90">
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
                  a4ai <span className="text-xs font-medium opacity-60 ml-1">About</span>
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
              <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
                <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold"><Sparkles className="h-3.5 w-3.5 mr-1"/> Founded 2025</span>
                <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold"><Rocket className="h-3.5 w-3.5 mr-1"/> Contest engine live</span>
                <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold"><ShieldCheck className="h-3.5 w-3.5 mr-1"/> Privacy‑first</span>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="text-center text-4xl sm:text-5xl lg:text-6xl leading-[1.15] font-black tracking-tight text-slate-900"
              >
                About <span className="nlm-text">a4ai</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
                className="mx-auto mt-6 max-w-3xl text-center text-lg md:text-xl font-medium text-slate-600"
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
                    className="p-6 text-center about-card bg-white"
                  >
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{s.v}</div>
                    <div className="mt-1.5 text-sm font-semibold text-slate-500">{s.k}</div>
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
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">Our mission</h2>
                <p className="mt-6 text-lg font-medium leading-relaxed text-slate-600">
                  Give teachers superpowers with AI that respects context and curriculum. Save hours weekly and return that time to students.
                </p>
                <p className="mt-4 text-lg font-medium leading-relaxed text-slate-600">
                  We combine multi‑LLM generation with rubric checks, plagiarism guards,
                  and contest‑grade proctoring to ensure quality from day one.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <button onClick={() => navigate("/features")} className="btn-blue-gradient px-8 py-3.5 text-base sm:text-lg font-bold flex items-center justify-center gap-2">
                    <span>See how it works</span>
                  </button>
                  <button onClick={() => navigate("/contact")} className="btn-white-action px-8 py-3.5 text-base sm:text-lg font-bold flex items-center justify-center gap-2">
                    <span>Talk to us</span>
                  </button>
                </div>

                <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { icon: Gauge, title: "Faster prep", copy: "Create aligned tests in minutes, not evenings." },
                    { icon: Shield, title: "Safer data", copy: "Privacy-first storage, clear consent, audit trails." },
                    { icon: BookOpen, title: "Better pedagogy", copy: "Curriculum mapping + rubric checks by default." },
                  ].map((item) => (
                    <div key={item.title} className="p-5 about-card bg-white">
                      <div className="flex items-center gap-2.5 font-bold text-slate-900">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <item.icon className="h-4 w-4" />
                        </div>
                        {item.title}
                      </div>
                      <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-600">{item.copy}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 40 }} animate={missionInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                <div className="overflow-hidden p-0 about-card bg-white shadow-sm border border-slate-200/90">
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
                <div className="mx-auto mb-4 inline-flex justify-center">
                  <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold">
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Our Core Philosophy
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                  What we <span className="nlm-text">value & build for</span>
                </h3>
                <p className="mt-3 text-slate-600 font-medium max-w-2xl mx-auto text-base sm:text-lg">
                  Uncompromising pedagogical principles that steer our AI product architecture and school policies.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto items-stretch">
                {values.map((x, i) => (
                  <ValueFeatureCard key={x.title} item={x} index={i} />
                ))}
              </div>
            </div>
          </section>

          {/* MILESTONES TIMELINE BLOCK */}
          <section className="relative z-10 py-16 bg-white">
            <div className="mx-auto max-w-5xl px-4 bg-transparent">
              <div className="text-center mb-12">
                <div className="mx-auto mb-4 inline-flex justify-center">
                  <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold">
                    <Rocket className="h-3.5 w-3.5 mr-1" />
                    Our Journey
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                  Milestones & <span className="nlm-text">Progress</span>
                </h3>
                <p className="mt-3 text-slate-600 font-medium max-w-2xl mx-auto text-base sm:text-lg">
                  From testing with our first 50 teachers to powering campus examinations.
                </p>
              </div>

              <div className="space-y-6 bg-transparent">
                {milestones.map((m, i) => (
                  <motion.div
                    key={m.title}
                    initial={{ opacity: 0, x: i % 2 ? 40 : -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="grid grid-cols-1 gap-4 p-6 md:grid-cols-[140px_1fr] about-card bg-white"
                  >
                    <div className="text-sm font-extrabold mt-1 text-blue-600">{m.date}</div>
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">{m.title}</div>
                      <div className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{m.detail}</div>
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
                <div className="mx-auto mb-4 inline-flex justify-center">
                  <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold">
                    <HeartHandshake className="h-3.5 w-3.5 mr-1" />
                    Leadership & Team
                  </span>
                </div>
                <motion.h2 {...fadeUp} className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-slate-900">
                  Team Behind a4ai
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="mx-auto max-w-3xl text-lg font-medium text-slate-600"
                >
                  A small team building a4ai — step by step, every day.
                </motion.p>
              </div>

              <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto bg-transparent">
                {team.map((m, i) => (
                  <TeamCard key={m.name} index={i} member={m} />
                ))}
              </div>

              <p className="mt-12 text-center text-sm font-semibold text-slate-400">
                …and many more people who quietly help shape a4ai every moment.
              </p>
            </div>
          </section>

          {/* PARTNERS ROW LAYOUT */}
          <section className="relative z-10 py-16 bg-white">
            <div className="mx-auto max-w-6xl px-4 bg-transparent">
              <div className="text-center bg-transparent">
                <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">Schools & partners</h3>
                <p className="mt-3 text-slate-600 font-medium">Pilots and early adopters we're grateful for.</p>
              </div>
              <div className="mt-12 grid grid-cols-2 items-center gap-6 sm:grid-cols-4 bg-transparent">
                {partners.map((p) => (
                  <div key={p.name} className="flex items-center justify-center p-8 about-card bg-white">
                    <span className="text-sm font-bold tracking-wide text-slate-800 hover:text-blue-600 transition-colors">
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
                    className="relative p-8 about-card bg-white flex flex-col"
                  >
                    <Quote className="absolute -top-3 -left-3 h-8 w-8 text-neutral-200/50" />
                    <p className="text-base font-semibold leading-relaxed italic text-slate-800">"{t.quote}"</p>
                    <footer className="mt-6 text-sm bg-transparent">
                      <span className="font-extrabold text-slate-900">{t.name}</span>,{" "}
                      <span className="font-medium text-slate-500">{t.title}</span>
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
                    className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900"
                  >
                    Ready to transform your assessments?
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                    className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-600"
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
                    <button onClick={() => navigate("/")} className="btn-blue-gradient px-8 py-3.5 text-base sm:text-lg font-bold flex items-center justify-center gap-2">
                      <span>Get started for free</span>
                    </button>
                    <button onClick={() => navigate("/contact")} className="btn-white-action px-8 py-3.5 text-base sm:text-lg font-bold flex items-center justify-center gap-2">
                      <span>Book a demo <ArrowRight className="h-5 w-5" /></span>
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

/* ──────────────────────────────────────────────────────────────
   UNIFIED VALUE FEATURE CARD COMPONENT (Matching FeaturesPage Pattern)
   ────────────────────────────────────────────────────────────── */
function ValueFeatureCard({ item, index }: { item: ValueItem; index: number }) {
  const mx = useMotionValue(120);
  const my = useMotionValue(90);
  const rotateX = useTransform(my, [0, 180], [7, -7]);
  const rotateY = useTransform(mx, [0, 260], [-8, 8]);
  const Icon = item.icon;
  const rafId = useRef<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const currentTarget = e.currentTarget;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!currentTarget) return;
      const r = currentTarget.getBoundingClientRect();
      mx.set(clientX - r.left);
      my.set(clientY - r.top);
    });
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.06 * index, duration: 0.5, ease: "easeOut" }}
      className="h-full flex flex-col"
    >
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mx.set(120); my.set(90); }}
        style={{ perspective: 1000 }}
        className="group h-full flex flex-col cursor-pointer"
      >
        <motion.div
          style={{ rotateX, rotateY, willChange: "transform" }}
          className="relative h-full p-6 transition-all duration-300 about-card bg-white flex flex-col"
        >
          {/* Radial cursor hover sheen */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
          />

          <div className="relative z-10 flex flex-col h-full">
            {/* Card Top: Icon Box + Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 flex-shrink-0">
                <Icon className="h-6 w-6 text-blue-600" />
                {item.tag && (
                  <span
                    className="absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200/80 shadow-xs"
                  >
                    {item.tag}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">{item.title}</h3>
            </div>

            {/* Description */}
            <p className="text-sm font-medium leading-relaxed mb-5 text-slate-600">
              {item.description}
            </p>

            {/* Checklist Bullets */}
            <ul className="space-y-3 mb-6 flex-grow">
              {item.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-medium">
                  <div className="h-5 w-5 rounded-full bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-slate-700 font-semibold leading-snug">{b}</span>
                </li>
              ))}
            </ul>

            {/* Card Footer: Tags & Action Link */}
            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <Link
                to={item.href || "/features"}
                className="inline-flex items-center text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors group-hover:translate-x-0.5 flex-shrink-0"
              >
                {item.cta || "Explore"}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
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
  const rafId = useRef<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const currentTarget = e.currentTarget;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!currentTarget) return;
      const r = currentTarget.getBoundingClientRect();
      mx.set(clientX - r.left);
      my.set(clientY - r.top);
    });
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.08 * index, ease: EASE }}
      className="relative bg-white"
    >
      <div 
        onMouseMove={handleMouseMove} 
        onMouseLeave={() => { mx.set(160); my.set(120); }} 
        style={{ perspective: 1000 }} 
        className="group cursor-pointer h-full"
      >
        <motion.div
          style={{ rotateX, rotateY, willChange: "transform" }}
          className="relative h-full p-6 transition-all duration-300 about-card bg-white"
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
          />
          <div className="relative z-10 text-center bg-transparent">
            <Avatar className="mx-auto mb-4 h-28 w-28 ring-4 ring-blue-50 border border-slate-200/80 shadow-xs">
              <AvatarImage src={member.image} alt={member.name} className="object-cover" />
              <AvatarFallback className="text-xl font-extrabold bg-blue-50 text-blue-700">
                {member.name.substring(0, 2)}
              </AvatarFallback>
            </Avatar>

            <h3 className="text-xl font-extrabold tracking-tight text-slate-900">{member.name}</h3>
            <p className="mt-1 text-sm font-bold text-blue-600">{member.role}</p>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">{member.description}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}